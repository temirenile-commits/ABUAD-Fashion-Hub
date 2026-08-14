import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthenticatedUser } from '@/lib/server-auth';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';

const execAsync = util.promisify(exec);

async function generateAndUploadReelCover(videoUrl: string, brandId: string, reelId: string): Promise<string | null> {
  const tmpDir = os.tmpdir();
  const tmpCoverPath = path.join(tmpDir, `cover_${reelId}.webp`);

  try {
    try {
      await execAsync(`ffmpeg -ss 00:00:01 -i "${videoUrl}" -vframes 1 -q:v 2 "${tmpCoverPath}" -y`);
    } catch {
      await execAsync(`ffmpeg -ss 00:00:00 -i "${videoUrl}" -vframes 1 -q:v 2 "${tmpCoverPath}" -y`);
    }

    if (!fs.existsSync(tmpCoverPath)) {
      return null;
    }

    const coverBuffer = fs.readFileSync(tmpCoverPath);
    const storagePath = `covers/${brandId}/${reelId}.webp`;
    
    const { error: uploadError } = await supabaseAdmin.storage
      .from('brand-reels')
      .upload(storagePath, coverBuffer, {
        contentType: 'image/webp',
        upsert: true
      });

    try { fs.unlinkSync(tmpCoverPath); } catch {}

    if (uploadError) {
      console.error('Failed to upload cover:', uploadError);
      return null;
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from('brand-reels')
      .getPublicUrl(storagePath);

    return publicUrlData.publicUrl;
  } catch (err) {
    console.error('Error generating reel cover:', err);
    try { fs.unlinkSync(tmpCoverPath); } catch {}
    return null;
  }
}

// GET /api/reels - Fetch published reels with products, search, and author info across all vendor types
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const section = searchParams.get('section');
    const brandId = searchParams.get('brand_id');
    const search = searchParams.get('search');
    const universityId = searchParams.get('universityId');

    // Get current authenticated user if any, to determine is_liked per reel
    const currentUser = await getAuthenticatedUser(req);
    const currentUserId = currentUser?.id;

    let query = supabaseAdmin
      .from('reels')
      .select(`
        *,
        brands (
          id,
          owner_id,
          name,
          whatsapp_number,
          verified,
          logo_url,
          category,
          marketplace_type
        ),
        reel_products (
          id,
          reel_id,
          product_id,
          sort_order,
          products (
            id,
            title,
            price,
            original_price,
            image_url,
            media_urls,
            stock_count
          )
        ),
        reel_likes (id, user_id),
        reel_comments (
          id,
          content,
          created_at,
          user_id
        )
      `)
      .neq('status', 'deleted')
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (section && section !== 'all') {
      query = query.eq('product_section', section);
    }
    if (brandId) {
      query = query.eq('brand_id', brandId);
    }
    if (search) {
      query = query.or(`title.ilike.%${search}%,caption.ilike.%${search}%`);
    }

    // Respect university visibility logic
    if (universityId) {
      query = query.or(`visibility_type.eq.all,and(visibility_type.eq.university,university_id.eq.${universityId})`);
    } else {
      query = query.eq('visibility_type', 'all');
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching reels:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch user profiles for comment authors if needed
    const userIds = new Set<string>();
    (data || []).forEach(reel => {
      (reel.reel_comments || []).forEach((c: any) => {
        if (c.user_id) userIds.add(c.user_id);
      });
    });

    let profileMap: { [key: string]: string } = {};
    if (userIds.size > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, email')
        .in('id', Array.from(userIds));

      if (profiles) {
        profiles.forEach(p => {
          profileMap[p.id] = p.full_name || p.email?.split('@')[0] || 'Campus User';
        });
      }
    }

    // Process reels to add is_liked and user_name to comments
    const processedReels = (data || []).map(reel => {
      const likes = reel.reel_likes || [];
      const comments = (reel.reel_comments || []).map((c: any) => ({
        ...c,
        user_name: profileMap[c.user_id] || 'Campus User'
      })).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const isLiked = currentUserId ? likes.some((l: any) => l.user_id === currentUserId) : false;

      return {
        ...reel,
        likes_count: likes.length,
        comments_count: comments.length,
        is_liked: isLiked,
        reel_comments: comments
      };
    });

    return NextResponse.json({ success: true, reels: processedReels });
  } catch (err: any) {
    console.error('Unexpected error in reels API:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/reels - Universal vendor upload reel with title, caption, products, and automatic cover generation for all vendor types
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { video_url, thumbnail_url, title, caption, product_section, visibility_type, university_id, product_ids } = body;

    if (!video_url) {
      return NextResponse.json({ error: 'video_url is required' }, { status: 400 });
    }

    // Verify brand ownership for any vendor type (Fashion, Delicacies, Electronics, Gadgets, etc.)
    const { data: brand, error: brandError } = await supabaseAdmin
      .from('brands')
      .select('id, category, marketplace_type')
      .eq('owner_id', user.id)
      .single();

    if (brandError || !brand) {
      return NextResponse.json({ error: 'Brand not found or vendor profile incomplete' }, { status: 404 });
    }

    // First insert reel without cover_url to get id
    const { data: reelData, error: reelError } = await supabaseAdmin
      .from('reels')
      .insert({
        brand_id: brand.id,
        video_url,
        thumbnail_url: thumbnail_url || null,
        title: title || 'New Collection',
        caption: caption || '',
        product_section: product_section || 'fashion',
        visibility_type: visibility_type || 'university',
        university_id: university_id || null,
        status: 'published'
      })
      .select()
      .single();

    if (reelError) {
      console.error('Error creating reel:', reelError);
      return NextResponse.json({ error: reelError.message }, { status: 500 });
    }

    // Automatically generate cover image from video
    const coverUrl = await generateAndUploadReelCover(video_url, brand.id, reelData.id);
    if (coverUrl) {
      await supabaseAdmin
        .from('reels')
        .update({ thumbnail_url: coverUrl, cover_url: coverUrl })
        .eq('id', reelData.id);
      reelData.thumbnail_url = coverUrl;
      reelData.cover_url = coverUrl;
    }

    // Attach products if provided with strict server-side ownership validation
    if (product_ids && Array.isArray(product_ids) && product_ids.length > 0) {
      // Verify that all product_ids belong to this vendor's brand_id
      const { data: validProducts, error: prodVerifyError } = await supabaseAdmin
        .from('products')
        .select('id')
        .eq('brand_id', brand.id)
        .in('id', product_ids);

      if (prodVerifyError) {
        console.error('Product ownership verification error:', prodVerifyError);
      } else if (validProducts && validProducts.length > 0) {
        const validIds = new Set(validProducts.map(p => p.id));
        const reelProducts = product_ids
          .filter((pid: string) => validIds.has(pid))
          .map((pid: string, idx: number) => ({
            reel_id: reelData.id,
            product_id: pid,
            sort_order: idx
          }));

        if (reelProducts.length > 0) {
          await supabaseAdmin.from('reel_products').insert(reelProducts);
        }
      }
    }

    return NextResponse.json({ success: true, reel: reelData });
  } catch (err: any) {
    console.error('Unexpected error creating reel:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/reels - Authoritative deletion from database
export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'reel id is required' }, { status: 400 });
    }

    // Verify ownership via brand
    const { data: reel, error: reelFetchError } = await supabaseAdmin
      .from('reels')
      .select('id, brand_id, brands(owner_id)')
      .eq('id', id)
      .single();

    if (reelFetchError || !reel) {
      return NextResponse.json({ error: 'Reel not found' }, { status: 404 });
    }

    const brandInfo = reel.brands as any;
    if (!brandInfo || brandInfo.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('reels')
      .update({ status: 'deleted' })
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Reel deleted successfully' });
  } catch (err: any) {
    console.error('Error deleting reel:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

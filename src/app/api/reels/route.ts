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
    const normalizedSearch = search?.trim().toLowerCase() || '';

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
    // Search is applied after the relational data is loaded so vendor and
    // attached-product metadata participate in the same database-backed result.
    // This preserves the existing feed filters and avoids a disconnected client-only filter.

    // Respect university visibility logic
    if (universityId) {
      query = query.or(`visibility_type.eq.all,visibility_type.eq.public,and(visibility_type.eq.university,university_id.eq.${universityId})`);
    } else {
      query = query.or(`visibility_type.eq.all,visibility_type.eq.public,visibility_type.eq.university`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching reels:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let matchingVendors: any[] = [];
    let visibleReels = data || [];

    if (normalizedSearch) {
      const safeSearch = normalizedSearch.replace(/[%,()]/g, ' ').replace(/\s+/g, ' ').trim();
      if (safeSearch) {
        const { data: vendorMatches, error: vendorSearchError } = await supabaseAdmin
          .from('brands')
          .select('id, name, logo_url, verified, category, marketplace_type')
          .or(`name.ilike.%${safeSearch}%,category.ilike.%${safeSearch}%,marketplace_type.ilike.%${safeSearch}%`)
          .limit(10);

        if (vendorSearchError) {
          console.error('Vendor search error:', vendorSearchError);
        }
        matchingVendors = vendorMatches || [];
      }

      const scoreMatch = (value: unknown, weight: number) => {
        const text = String(value || '').toLowerCase();
        if (!text || !text.includes(normalizedSearch)) return 0;
        if (text === normalizedSearch) return weight * 4;
        if (text.startsWith(normalizedSearch)) return weight * 3;
        return weight;
      };

      visibleReels = visibleReels
        .map((reel: any) => {
          const productTitles = (reel.reel_products || [])
            .map((relation: any) => relation.products?.title)
            .filter(Boolean);
          const score = Math.max(
            scoreMatch(reel.brands?.name, 100),
            scoreMatch(reel.title, 90),
            ...productTitles.map((title: string) => scoreMatch(title, 80)),
            scoreMatch(reel.caption, 40),
            scoreMatch(reel.brands?.category, 30)
          );
          return { reel, score };
        })
        .filter(({ score }) => score > 0)
        .sort((a: any, b: any) => b.score - a.score)
        .map(({ reel }: any) => reel);
    }

    // Fetch user details for comment authors
    const userIds = new Set<string>();
    visibleReels.forEach(reel => {
      (reel.reel_comments || []).forEach((c: any) => {
        if (c.user_id) userIds.add(c.user_id);
      });
    });

    let authorIdentityMap: { [key: string]: any } = {};
    if (userIds.size > 0) {
      const idList = Array.from(userIds);
      
      // Fetch users
      const { data: users } = await supabaseAdmin
        .from('users')
        .select('id, name, avatar_url, role')
        .in('id', idList);

      // Fetch brands (vendors)
      const { data: brands } = await supabaseAdmin
        .from('brands')
        .select('id, owner_id, name, logo_url, verified')
        .in('owner_id', idList);

      if (users) {
        users.forEach(u => {
          const brand = brands?.find(b => b.owner_id === u.id);
          
          if (brand) {
            // Vendor Identity
            authorIdentityMap[u.id] = {
              type: 'vendor',
              name: brand.name,
              avatar: brand.logo_url,
              verified: brand.verified,
              brand_id: brand.id
            };
          } else {
            // Customer Identity
            authorIdentityMap[u.id] = {
              type: 'customer',
              name: u.name || 'Campus User',
              avatar: u.avatar_url,
              verified: false
            };
          }
        });
      }
    }

    // Process reels to add is_liked and detailed comment author info
    const processedReels = visibleReels.map(reel => {
      const likes = reel.reel_likes || [];
      const comments = (reel.reel_comments || []).map((c: any) => {
        const identity = authorIdentityMap[c.user_id] || {
          type: 'customer',
          name: 'Campus User',
          avatar: null,
          verified: false
        };
        
        return {
          ...c,
          author_type: identity.type,
          user_name: identity.name, // Keep for backward compatibility
          author_name: identity.name,
          author_avatar: identity.avatar,
          author_verified: identity.verified,
          author_brand_id: identity.brand_id
        };
      }).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const isLiked = currentUserId ? likes.some((l: any) => l.user_id === currentUserId) : false;

      return {
        ...reel,
        likes_count: likes.length,
        comments_count: comments.length,
        is_liked: isLiked,
        reel_comments: comments
      };
    });

    return NextResponse.json({ success: true, reels: processedReels, vendors: matchingVendors });
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
      .select('id, category, marketplace_type, university_id')
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
        visibility_type: visibility_type || (brand.university_id ? 'university' : 'public'),
        university_id: university_id || brand.university_id || null,
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

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthenticatedUser } from '@/lib/server-auth';

// GET /api/reels - Fetch published reels with products, search, and author info (strictly excluding deleted)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const section = searchParams.get('section');
    const brandId = searchParams.get('brand_id');
    const search = searchParams.get('search');
    const universityId = searchParams.get('universityId');

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
          logo_url
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

    return NextResponse.json({ success: true, reels: data || [] });
  } catch (err: any) {
    console.error('Unexpected error in reels API:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/reels - Vendor upload reel with title, caption, products
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

    // Verify brand ownership
    const { data: brand, error: brandError } = await supabaseAdmin
      .from('brands')
      .select('id')
      .eq('owner_id', user.id)
      .single();

    if (brandError || !brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }

    // Insert reel
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

    // Attach products if provided
    if (product_ids && Array.isArray(product_ids) && product_ids.length > 0) {
      const reelProducts = product_ids.map((pid: string, idx: number) => ({
        reel_id: reelData.id,
        product_id: pid,
        sort_order: idx
      }));

      await supabaseAdmin.from('reel_products').insert(reelProducts);
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
    const reelId = searchParams.get('id');

    if (!reelId) {
      return NextResponse.json({ error: 'Reel ID is required' }, { status: 400 });
    }

    // Verify vendor ownership or admin status
    const { data: reelData, error: fetchErr } = await supabaseAdmin
      .from('reels')
      .select('brand_id, brands(owner_id)')
      .eq('id', reelId)
      .single();

    if (fetchErr || !reelData) {
      return NextResponse.json({ error: 'Reel not found' }, { status: 404 });
    }

    const isOwner = (reelData.brands as any)?.owner_id === user.id;
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Mark as deleted in database (source of truth)
    const { error: deleteErr } = await supabaseAdmin
      .from('reels')
      .update({ status: 'deleted' })
      .eq('id', reelId);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 400 });
    }

    // Clean up junction relations
    await supabaseAdmin.from('reel_products').delete().eq('reel_id', reelId);

    return NextResponse.json({ success: true, message: 'Reel deleted successfully' });
  } catch (err: any) {
    console.error('Error deleting reel:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

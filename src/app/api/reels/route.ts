import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const section = searchParams.get('section') || 'fashion';
    const brandId = searchParams.get('brand_id');

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
        )
      `)
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (section) {
      query = query.eq('product_section', section);
    }
    if (brandId) {
      query = query.eq('brand_id', brandId);
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { brand_id, video_url, thumbnail_url, title, caption, product_section, product_ids } = body;

    if (!brand_id || !video_url) {
      return NextResponse.json({ error: 'brand_id and video_url are required' }, { status: 400 });
    }

    // Insert reel
    const { data: reelData, error: reelError } = await supabaseAdmin
      .from('reels')
      .insert({
        brand_id,
        video_url,
        thumbnail_url: thumbnail_url || null,
        title: title || 'New Collection',
        caption: caption || '',
        product_section: product_section || 'fashion',
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

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';


export async function POST(req: Request) {
  try {
    const { 
      title, 
      description, 
      price, 
      originalPrice, 
      category, 
      stockCount, 
      mediaUrls, 
      imageUrl,
      videoUrl,
      brandId,
      ownerId,
      variants,
      isDraft
    } = await req.json();

    if (!title || !price || !brandId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Create the Product record
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .insert({
        title,
        description,
        price: Number(price),
        original_price: originalPrice ? Number(originalPrice) : null,
        category,
        stock_count: stockCount ? Number(stockCount) : 10,
        media_urls: mediaUrls || [],
        image_url: imageUrl || (mediaUrls && mediaUrls[0]) || null,
        video_url: videoUrl || null,
        brand_id: brandId,
        owner_id: ownerId,
        variants: variants || [],
        is_draft: isDraft || false,
        is_featured: false,
        is_flash_sale: false,
        rating: 5,
        sold: 0,
        views_count: 0
      })
      .select()
      .single();

    if (productError) throw productError;

    // 2. Notify Follower/Marketplace (Optional smart trigger)
    // For now, just return success
    return NextResponse.json({
      success: true,
      product: product
    });

  } catch (error: any) {
    console.error('Product listing error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

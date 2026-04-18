import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

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
      brandId,
      ownerId 
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
        stock_count: stockCount ? Number(stockCount) : 10, // Default to 10 if not provided
        media_urls: mediaUrls || [],
        brand_id: brandId,
        is_featured: false,
        is_flash_sale: false,
        rating: 5, // Default new items to 5 stars
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

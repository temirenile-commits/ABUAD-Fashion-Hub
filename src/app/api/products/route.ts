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
      isDraft,
      isPreorder,
      preorderArrivalDate,
      product_section // New field
    } = await req.json();

    if (!title || !price || !brandId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Edible/Consumable validation (Only for normal fashion marketplace)
    if (product_section !== 'delicacies') {
      const restrictedKeywords = ['food', 'drink', 'groceries', 'supplement', 'edible', 'consumable', 'snack', 'beverage', 'meal'];
      const textToSearch = `${title} ${description} ${category}`.toLowerCase();
      
      if (restrictedKeywords.some(keyword => textToSearch.includes(keyword))) {
        return NextResponse.json({ error: 'Edible or consumable items are not allowed on this platform. Please use the Chief Chef Dashboard to list delicacies.' }, { status: 400 });
      }
    }

    // 0. Fetch Brand & Credit Check
    const { data: brand, error: brandError } = await supabaseAdmin
      .from('brands')
      .select('free_listings_count, university_id')
      .eq('id', brandId)
      .single();

    if (brandError || !brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }

    if (!isDraft) {
      if (brand.free_listings_count <= 0) {
        return NextResponse.json({ 
          error: 'Insufficient listing credits. Please upgrade your plan to upload more products.',
          insufficientCredits: true 
        }, { status: 403 });
      }
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
        product_section: product_section || 'fashion',
        delicacy_category: product_section === 'delicacies' ? category : null,
        stock_count: typeof stockCount === 'number' ? stockCount : 10,
        media_urls: mediaUrls || [],
        image_url: imageUrl || (mediaUrls && mediaUrls[0]) || null,
        video_url: videoUrl || null,
        brand_id: brandId,
        owner_id: ownerId,
        university_id: brand.university_id,
        visibility_type: brand.university_id ? 'university' : 'global',
        variants: variants || [],
        is_draft: isDraft || false,
        is_featured: false,
        is_flash_sale: false,
        rating: 5,
        sold: 0,
        views_count: 0,
        is_preorder: isPreorder || false,
        preorder_arrival_date: isPreorder && preorderArrivalDate ? new Date(preorderArrivalDate).toISOString() : null
      })
      .select()
      .single();

    if (productError) throw productError;

    // 1.1 Decrement credits if live
    if (!isDraft) {
      await supabaseAdmin.rpc('decrement_listing_credits', { p_brand_id: brandId });
    }

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


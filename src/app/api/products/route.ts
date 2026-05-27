import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const VALID_DELICACY_CATEGORIES = [
  'snacks', 'small_chops', 'pastries_baked', 'drinks_beverages',
  'provisions', 'combo_packages', 'frozen_chilled', 'seasonal_trending', 'other'
];

function safeDelicacyCategory(section: string, category: string): string | null {
  if (section !== 'delicacies') return null; // ALWAYS null for fashion — fixes DB constraint
  return VALID_DELICACY_CATEGORIES.includes(category) ? category : 'other';
}

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
      product_section,
      location_availability,
      commission_rate,
      delivery_rate,
      cafeteria_ids,
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
      .select('free_listings_count, university_id, marketplace_type, subscription_expires_at, trial_started_at')
      .eq('id', brandId)
      .single();

    if (brandError || !brand) {
      console.error('[API PRODUCTS] Brand Error:', brandError, 'ID:', brandId);
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    }

    const isSubActive = brand.subscription_expires_at && new Date(brand.subscription_expires_at) > new Date();
    const isTrialActive = brand.trial_started_at && 
      (new Date().getTime() - new Date(brand.trial_started_at).getTime()) < (7 * 24 * 60 * 60 * 1000);

    if (!isDraft) {
      if (!isTrialActive && !isSubActive && (brand.free_listings_count || 0) <= 0) {
        return NextResponse.json({ 
          error: 'Insufficient listing credits. Please upgrade your plan to upload more products.',
          insufficientCredits: true 
        }, { status: 403 });
      }
    }

    // Determine section based on brand type
    const brandType = brand.marketplace_type || 'fashion';
    const effectiveSection = brandType === 'delicacies' ? 'delicacies' : 'fashion';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertPayload: any = {
      title,
      description,
      price: Number(price),
      original_price: originalPrice ? Number(originalPrice) : null,
      category,
      product_section: effectiveSection,
      // KEY FIX: delicacy_category is ALWAYS null for fashion — prevents DB constraint error
      delicacy_category: safeDelicacyCategory(effectiveSection, category),
      stock_count: stockCount ? Number(stockCount) : 0,
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
      preorder_arrival_date: isPreorder && preorderArrivalDate ? new Date(preorderArrivalDate).toISOString() : null,
      location_availability: location_availability || null,
      commission_rate: commission_rate != null ? Number(commission_rate) : null,
      delivery_rate: delivery_rate != null ? Number(delivery_rate) : null,
      cafeteria_ids: cafeteria_ids || [],
    };

    // 1. Create the Product record
    let { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .insert(insertPayload)
      .select()
      .single();

    // Fallback: If DB constraint product_delicacy_category_check is violated (e.g. outdated DB schema)
    if (productError && productError.message.includes('product_delicacy_category_check')) {
      console.warn('[API PRODUCTS] Check constraint violated, retrying with fallback category...');
      let fallbackCat = 'other';
      if (category === 'drinks_beverages') fallbackCat = 'drinks';
      else if (category === 'pastries_baked') fallbackCat = 'snacks';
      
      insertPayload.delicacy_category = fallbackCat;
      const retry = await supabaseAdmin.from('products').insert(insertPayload).select().single();
      product = retry.data;
      productError = retry.error;
    }

    if (productError && (productError.message.includes('schema cache') || productError.message.includes('column'))) {
      delete insertPayload.is_preorder;
      delete insertPayload.preorder_arrival_date;
      delete insertPayload.commission_rate;
      delete insertPayload.delivery_rate;
      const fallback = await supabaseAdmin.from('products').insert(insertPayload).select().single();
      product = fallback.data;
      productError = fallback.error;
    }

    if (productError) throw productError;

    // 1.1 Decrement credits if live
    if (!isDraft) {
      await supabaseAdmin.rpc('decrement_listing_credits', { p_brand_id: brandId });
    }

    return NextResponse.json({ success: true, product });

  } catch (error: any) {
    console.error('Product listing error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// PATCH — Update existing product (fixes constraint on edit)
export async function PATCH(req: Request) {
  try {
    const {
      productId,
      title,
      description,
      price,
      originalPrice,
      category,
      stockCount,
      mediaUrls,
      imageUrl,
      videoUrl,
      variants,
      isDraft,
      isPreorder,
      preorderArrivalDate,
      location_availability,
      commission_rate,
      delivery_rate,
      cafeteria_ids,
    } = await req.json();

    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 });
    }

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('products')
      .select('product_section, brand_id')
      .eq('id', productId)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const effectiveSection = existing.product_section || 'fashion';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatePayload: any = { updated_at: new Date().toISOString() };

    if (title !== undefined) updatePayload.title = title;
    if (description !== undefined) updatePayload.description = description;
    if (price !== undefined) updatePayload.price = Number(price);
    if (originalPrice !== undefined) updatePayload.original_price = originalPrice ? Number(originalPrice) : null;
    if (category !== undefined) {
      updatePayload.category = category;
      updatePayload.delicacy_category = safeDelicacyCategory(effectiveSection, category);
    }
    if (stockCount !== undefined) updatePayload.stock_count = Number(stockCount);
    if (mediaUrls !== undefined) updatePayload.media_urls = mediaUrls;
    if (imageUrl !== undefined) updatePayload.image_url = imageUrl;
    if (videoUrl !== undefined) updatePayload.video_url = videoUrl;
    if (variants !== undefined) updatePayload.variants = variants;
    if (isDraft !== undefined) updatePayload.is_draft = isDraft;
    if (isPreorder !== undefined) updatePayload.is_preorder = isPreorder;
    if (preorderArrivalDate !== undefined) updatePayload.preorder_arrival_date = isPreorder && preorderArrivalDate ? new Date(preorderArrivalDate).toISOString() : null;
    if (location_availability !== undefined) updatePayload.location_availability = location_availability;
    if (commission_rate !== undefined) updatePayload.commission_rate = commission_rate != null ? Number(commission_rate) : null;
    if (delivery_rate !== undefined) updatePayload.delivery_rate = delivery_rate != null ? Number(delivery_rate) : null;
    if (cafeteria_ids !== undefined) updatePayload.cafeteria_ids = cafeteria_ids || [];

    let { error: updateError } = await supabaseAdmin.from('products').update(updatePayload).eq('id', productId);

    if (updateError && updateError.message.includes('product_delicacy_category_check')) {
      console.warn('[API PRODUCTS] PATCH check constraint violated, retrying with fallback category...');
      let fallbackCat = 'other';
      if (category === 'drinks_beverages') fallbackCat = 'drinks';
      else if (category === 'pastries_baked') fallbackCat = 'snacks';
      
      updatePayload.delicacy_category = fallbackCat;
      const retry = await supabaseAdmin.from('products').update(updatePayload).eq('id', productId);
      updateError = retry.error;
    }

    if (updateError) {
      if (updateError.message.includes('schema cache') || updateError.message.includes('column')) {
        delete updatePayload.commission_rate;
        delete updatePayload.delivery_rate;
        delete updatePayload.is_preorder;
        delete updatePayload.preorder_arrival_date;
        const { error: fallbackErr } = await supabaseAdmin.from('products').update(updatePayload).eq('id', productId);
        if (fallbackErr) throw fallbackErr;
        return NextResponse.json({ success: true, fallback: true });
      }
      throw updateError;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Product update error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

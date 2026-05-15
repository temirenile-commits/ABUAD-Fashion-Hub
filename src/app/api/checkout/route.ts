/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { initializeTransaction } from '@/lib/paystack';

export async function POST(req: Request) {
  // Default fallbacks
  const commissionRate = 0; 

  try {
    const { userId, items, shippingAddress, promoCode } = await req.json();

    if (!userId || !items || items.length === 0) {
      return NextResponse.json({ error: 'Invalid checkout payload' }, { status: 400 });
    }

    // 0. Parallel Fetching for speed (Verify items, User profile, and Platform Fees)
    const productIds = items.map((i: { productId: string }) => i.productId);
    
    const [productsResult, profileResult, settingsResult, promoResult] = await Promise.all([
      supabaseAdmin
        .from('products')
        .select('id, title, brand_id, price, stock_count, university_id, visibility_type, brands(verified, fee_paid, delivery_scope, assigned_delivery_system)')
        .in('id', productIds),
      supabaseAdmin
        .from('users')
        .select('email, university_id')
        .eq('id', userId)
        .single(),
      supabaseAdmin
        .from('platform_settings')
        .select('value')
        .eq('key', 'platform_fees')
        .single(),
      promoCode ? supabaseAdmin.from('promo_codes').select('*').eq('code', promoCode.toUpperCase()).eq('is_active', true).single() : Promise.resolve({ data: null })
    ]);

    const liveProducts = productsResult.data;
    const userProfile = profileResult.data;
    let promoData = promoResult?.data;

    if (!liveProducts || liveProducts.length === 0) {
      return NextResponse.json({ error: 'STALE_CART_ITEMS' }, { status: 400 });
    }

    // --- PROMO CODE VALIDATION ---
    if (promoData) {
      // 1. Expiration Check
      if (promoData.expires_at && new Date(promoData.expires_at) < new Date()) {
        return NextResponse.json({ error: 'PROMO_EXPIRED', message: 'This promo code has expired.' }, { status: 400 });
      }
      // 2. Max Uses Check
      if (promoData.current_uses >= promoData.max_uses) {
         return NextResponse.json({ error: 'PROMO_LIMIT_REACHED', message: 'This promo code has reached its maximum usage limit.' }, { status: 400 });
      }
      // 3. Target Customer Check
      if (promoData.target_customer_id && promoData.target_customer_id !== userId) {
         return NextResponse.json({ error: 'PROMO_NOT_ELIGIBLE', message: 'You are not eligible for this promo code.' }, { status: 400 });
      }
      // 4. Regular Patronizer Check (Vendor specific)
      if (promoData.is_regular_patrons_only && promoData.brand_id) {
         const { count } = await supabaseAdmin.from('orders').select('*', { count: 'exact', head: true }).eq('customer_id', userId).eq('brand_id', promoData.brand_id).eq('status', 'delivered');
         if (!count || count < 2) {
             return NextResponse.json({ error: 'PROMO_REGULAR_ONLY', message: 'This promo code is strictly for regular patronizers of this vendor.' }, { status: 400 });
         }
      }
    }

    // 1. Verify Brands activation status
    const inactiveBrands = liveProducts.filter((p: any) => !p.brands || (Array.isArray(p.brands) ? !p.brands[0].verified : !p.brands.verified));
    if (inactiveBrands.length > 0) {
       return NextResponse.json({ 
        error: 'INACTIVE_VENDORS', 
        message: 'A brand in your cart is currently offline. Please remove their items to proceed.' 
      }, { status: 400 });
    }

    // 1.2 University Scoping Check (Safety Rule)
    const userUniId = userProfile?.university_id;
    for (const p of liveProducts) {
      const isGlobal = p.visibility_type === 'global';
      const isMyUni = p.university_id === userUniId;
      
      if (!isGlobal && !isMyUni) {
        return NextResponse.json({
          error: 'SCOPE_VIOLATION',
          message: `The product "${p.title}" is restricted to another university and cannot be ordered from your current location.`
        }, { status: 403 });
      }
    }

    // 1.5 Verify Stock Quantity
    for (const item of items) {
      const liveProduct = liveProducts.find((p) => p.id === item.productId);
      if (!liveProduct || (liveProduct.stock_count < (item.quantity || 1))) {
        return NextResponse.json({ 
          error: 'OUT_OF_STOCK', 
          message: `Product "${liveProduct?.title || 'Unknown'}" does not have enough stock available.` 
        }, { status: 400 });
      }
    }

    // 2. Determine Delivery Logic from Brands
    const hasOutSchool = liveProducts.some((p: any) => (Array.isArray(p.brands) ? p.brands[0].delivery_scope : p.brands?.delivery_scope) === 'out-school');
    const hasPlatform = liveProducts.some((p: any) => (Array.isArray(p.brands) ? p.brands[0].assigned_delivery_system : p.brands?.assigned_delivery_system) === 'platform');
    
    // Fetch dynamic fees from settings
    const universityId = liveProducts[0]?.university_id;
    const { data: uniConfigData } = universityId 
      ? await supabaseAdmin.from('platform_settings').select('value').eq('key', `uni_config_${universityId}`).single()
      : { data: null };
    
    const uniConfig = (uniConfigData as any)?.value || {};
    const settingsDeliveryFee = Number(uniConfig.delivery_base_fee) || Number(settingsResult.data?.value?.delivery_base_fee) || 1500;
    const dynamicCommissionRate = uniConfig.commission_rate !== undefined ? (Number(uniConfig.commission_rate) / 100) : commissionRate;
    
    let totalDeliveryFee = 0;
    if (hasPlatform) {
      if (hasOutSchool) {
        // Fetch average fee of active out-campus agents for this university
        const { data: agents } = await supabaseAdmin
          .from('delivery_agents')
          .select('base_delivery_fee')
          .eq('university_id', universityId)
          .eq('agent_type', 'out-campus')
          .eq('is_active', true);
        
        const avgAgentFee = (agents && agents.length > 0) 
          ? (agents.reduce((sum, a) => sum + Number(a.base_delivery_fee), 0) / agents.length)
          : settingsDeliveryFee;
        
        const markup = Number(uniConfig.external_delivery_markup) || 0;
        totalDeliveryFee = avgAgentFee + markup;
      } else {
        totalDeliveryFee = settingsDeliveryFee;
      }
    }

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30);

    const ordersToInsert = items.map((item: { productId: string; quantity: number; price: number; brandId: string; is_preorder?: boolean; preorder_arrival_date?: string; variants_selected?: Record<string, string> }, index: number) => {
      const liveProduct = liveProducts.find(p => p.id === item.productId);
      const originalPrice = liveProduct?.price || item.price;
      const isFirst = index === 0;
      
      const brandData = (Array.isArray(liveProduct?.brands) ? liveProduct.brands[0] : liveProduct?.brands) as any;
      
      const vendorScope = brandData?.delivery_scope || 'in-school';
      const vendorSystem = brandData?.assigned_delivery_system || 'platform';

      const baseItemSubtotal = originalPrice * (item.quantity || 1);
      
      // Calculate Discount (Paid by Admin or Vendor)
      let itemDiscount = 0;
      if (promoData) {
          const isBrandMatch = !promoData.brand_id || promoData.brand_id === item.brandId;
          const isProductMatch = !promoData.product_id || promoData.product_id === item.productId;
          
          if (isBrandMatch && isProductMatch) {
              if (promoData.type === 'percentage') {
                  itemDiscount = baseItemSubtotal * (Number(promoData.value) / 100);
              } else if (promoData.type === 'fixed') {
                  // For fixed discounts, only apply to the FIRST matching item in the batch
                  const firstMatchingIndex = items.findIndex((it: any) => {
                      const itBrandMatch = !promoData.brand_id || promoData.brand_id === it.brandId;
                      const itProductMatch = !promoData.product_id || promoData.product_id === it.productId;
                      return itBrandMatch && itProductMatch;
                  });
                  itemDiscount = index === firstMatchingIndex ? Number(promoData.value) : 0; 
              }
          }
      }

      const discountedItemSubtotal = Math.max(0, baseItemSubtotal - itemDiscount);
      // Only charge delivery fee on the FIRST item of the order batch
      const itemDeliveryFee = isFirst ? totalDeliveryFee : 0;
      const finalItemTotal = discountedItemSubtotal + itemDeliveryFee;
      
      const baseCommission = baseItemSubtotal * dynamicCommissionRate;
      const vendorEarning = baseItemSubtotal - baseCommission;
      const adminCommission = baseCommission - itemDiscount;
      const totalCommissionForRecord = adminCommission + itemDeliveryFee;

      const deliveryCode = Math.floor(100000 + Math.random() * 900000).toString();

      return {
        customer_id: userId,
        brand_id: item.brandId,
        product_id: item.productId,
        quantity: item.quantity || 1,
        total_amount: finalItemTotal, 
        commission_amount: totalCommissionForRecord,
        vendor_earning: vendorEarning,
        status: 'pending',
        delivery_method: vendorSystem,
        delivery_scope: vendorScope,
        assigned_delivery_system: vendorSystem,
        shipping_address: shippingAddress,
        paystack_reference: '', 
        expires_at: expiresAt.toISOString(),
        admin_discount: itemDiscount,
        delivery_code: deliveryCode,
        delivery_fee_charged: itemDeliveryFee, // Explicitly track the fee
        university_id: brandData?.university_id, // Explicitly tag with university for scoping
        is_preorder: item.is_preorder || false,
        preorder_arrival_date: item.preorder_arrival_date || null,
        variants_selected: item.variants_selected || {},
      };
    });

    const calculatedSubtotal = ordersToInsert.reduce((sum: number, o: any) => sum + Number(o.total_amount), 0);
    const finalChargeAmount = calculatedSubtotal; 
    const batchReference = `BATCH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Fill the reference
    ordersToInsert.forEach((o: any) => o.paystack_reference = batchReference);


    // 3. SECURE DATA PERSISTENCE: Save state before redirect
    const { error: orderError } = await supabaseAdmin.from('orders').insert(ordersToInsert);
    if (orderError) throw orderError;

    // 4. FAST REDIRECT: Initialize Paystack
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const host = req.headers.get('host') || 'mastercart.com';
    const baseDomain = host.includes('localhost') ? `${protocol}://${host}` : 'https://mastercart.com';
    const callbackUrl = `${baseDomain}/checkout/success?ref=${batchReference}`;

    const paystackData = await initializeTransaction({
      email: userProfile?.email || 'customer@mastercart.com',
      amount: finalChargeAmount,
      reference: batchReference,
      callback_url: callbackUrl,
      metadata: {
        payment_type: 'customer_checkout',
        user_id: userId,
        order_count: items.length
      }
    });

    return NextResponse.json({ 
      authorization_url: paystackData.authorization_url, 
      reference: batchReference 
    });

  } catch (error: any) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

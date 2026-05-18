import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, totalAmount, shippingAddress, promoCode, items, senderBank, senderAccount, transferReference } = body;

    if (!userId || !items || items.length === 0 || !shippingAddress || !senderBank || !senderAccount || !transferReference) {
      return NextResponse.json({ error: 'MISSING_FIELDS', message: 'Please fill in all manual transfer confirmation details.' }, { status: 400 });
    }

    // 1. Fetch products & user profile
    const productIds = items.map((it: any) => it.productId);
    const [productsResult, profileResult, settingsResult, promoResult] = await Promise.all([
      supabaseAdmin.from('products').select('*, brands(name, verified, delivery_scope, assigned_delivery_system, university_id)').in('id', productIds),
      supabaseAdmin.from('users').select('*').eq('id', userId).single(),
      supabaseAdmin.from('platform_settings').select('value').eq('key', 'platform_fees').single(),
      promoCode ? supabaseAdmin.from('promo_codes').select('*').eq('code', promoCode.toUpperCase()).eq('is_active', true).single() : Promise.resolve({ data: null })
    ]);

    const liveProducts = productsResult.data;
    const userProfile = profileResult.data;
    const promoData = promoResult?.data;

    if (!liveProducts || liveProducts.length === 0) {
      return NextResponse.json({ error: 'STALE_CART_ITEMS' }, { status: 400 });
    }

    // --- PROMO CODE VALIDATION ---
    if (promoData) {
      if (promoData.expires_at && new Date(promoData.expires_at) < new Date()) {
        return NextResponse.json({ error: 'PROMO_EXPIRED', message: 'This promo code has expired.' }, { status: 400 });
      }
      if (promoData.current_uses >= promoData.max_uses) {
        return NextResponse.json({ error: 'PROMO_LIMIT_REACHED', message: 'This promo code has reached its maximum usage limit.' }, { status: 400 });
      }
      if (promoData.target_customer_id && promoData.target_customer_id !== userId) {
        return NextResponse.json({ error: 'PROMO_NOT_ELIGIBLE', message: 'You are not eligible for this promo code.' }, { status: 400 });
      }
    }

    // 2. Verify Brands activation status
    const inactiveBrands = liveProducts.filter((p: any) => !p.brands || !p.brands.verified);
    if (inactiveBrands.length > 0) {
       return NextResponse.json({ 
        error: 'INACTIVE_VENDORS', 
        message: 'A brand in your cart is currently offline. Please remove their items to proceed.' 
      }, { status: 400 });
    }

    // 3. University Scoping Check
    const userUniId = userProfile?.university_id;
    for (const p of liveProducts) {
      const isGlobal = p.visibility_type === 'global';
      const isMyUni = p.university_id === userUniId;
      if (!isGlobal && !isMyUni) {
        return NextResponse.json({
          error: 'SCOPE_VIOLATION',
          message: `The product "${p.title}" is restricted to another university.`
        }, { status: 403 });
      }
    }

    // 4. Verify Stock Quantity
    for (const item of items) {
      const liveProduct = liveProducts.find((p) => p.id === item.productId);
      if (!liveProduct || (liveProduct.stock_count !== -1 && liveProduct.stock_count < (item.quantity || 1))) {
        return NextResponse.json({ 
          error: 'OUT_OF_STOCK', 
          message: `Product "${liveProduct?.title || 'Unknown'}" does not have enough stock available.` 
        }, { status: 400 });
      }
    }

    // 5. Calculate Delivery & Commission
    const universityId = liveProducts[0]?.university_id;
    const { data: uniConfigData } = universityId 
      ? await supabaseAdmin.from('platform_settings').select('value').eq('key', `uni_config_${universityId}`).single()
      : { data: null };

    const platformFees = settingsResult.data?.value || {};
    const commissionRate = platformFees.commission_rate !== undefined ? (Number(platformFees.commission_rate) / 100) : 0.10;
    const uniConfig = (uniConfigData as any)?.value || {};
    const settingsDeliveryFee = Number(uniConfig.delivery_base_fee) || Number(platformFees.delivery_base_fee) || 1500;
    const dynamicCommissionRate = uniConfig.commission_rate !== undefined ? (Number(uniConfig.commission_rate) / 100) : commissionRate;

    const hasPlatform = liveProducts.some((p: any) => p.brands?.assigned_delivery_system === 'platform');
    const hasOutSchool = liveProducts.some((p: any) => p.brands?.delivery_scope === 'out-school');

    let totalDeliveryFee = 0;
    if (hasPlatform) {
      if (hasOutSchool) {
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

    // Per-product delicacies delivery rates overrides
    const hasPerProductDelivery = (liveProducts as any[]).some(p => Number(p.delivery_rate) > 0 || p.product_section === 'delicacies');
    if (hasPerProductDelivery) {
      totalDeliveryFee = 0;
    }

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 120); // Longer window for manual validation

    const batchReference = `MANUAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const ordersToInsert = items.map((item: any, index: number) => {
      const liveProduct = liveProducts.find(p => p.id === item.productId);
      let originalPrice = liveProduct?.price || item.price;
      
      // Calculate active base price from selected variants if applicable
      if (item.variants_selected && liveProduct?.variants) {
        Object.entries(item.variants_selected).forEach(([type, val]) => {
          const match = (liveProduct.variants as any[] || []).find((v: any) => v.type === type && v.value === val);
          if (match && match.price !== undefined && match.price !== null && Number(match.price) > 0) {
            originalPrice = Number(match.price);
          }
        });
      }

      const isFirst = index === 0;
      const brandData = liveProduct?.brands as any;
      const vendorScope = brandData?.delivery_scope || 'in-school';
      const vendorSystem = brandData?.assigned_delivery_system || 'platform';
      
      const liveCommission = Number(liveProduct?.commission_price || 0);
      const liveDeliveryRate = Number(liveProduct?.delivery_rate || 0);
      const effectiveItemPrice = originalPrice + liveCommission + liveDeliveryRate;

      const baseItemSubtotal = effectiveItemPrice * (item.quantity || 1);
      
      let itemDiscount = 0;
      if (promoData) {
        const isBrandMatch = !promoData.brand_id || promoData.brand_id === item.brandId;
        const isProductMatch = !promoData.product_id || promoData.product_id === item.productId;
        
        if (isBrandMatch && isProductMatch) {
          if (promoData.type === 'percentage') {
            itemDiscount = baseItemSubtotal * (Number(promoData.value) / 100);
          } else if (promoData.type === 'fixed') {
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
      const itemDeliveryFee = isFirst ? totalDeliveryFee : 0;
      const finalItemTotal = discountedItemSubtotal + itemDeliveryFee;
      
      const standardCommission = (originalPrice * (item.quantity || 1)) * dynamicCommissionRate;
      let vendorEarning = (originalPrice * (item.quantity || 1)) - standardCommission;
      let adminCommission = standardCommission + (liveCommission + liveDeliveryRate) * (item.quantity || 1);

      if (promoData?.creator_type === 'vendor') {
        vendorEarning -= itemDiscount;
      } else {
        adminCommission -= itemDiscount;
      }

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
        status: 'pending', // Main order status: remains pending until verified by admin
        payment_system: 'manual',
        manual_payment_status: 'pending',
        manual_payment_details: {
          sender_bank: senderBank,
          sender_account: senderAccount,
          account_name: senderAccount,
          transfer_reference: transferReference,
          receipt_code: transferReference,
          submitted_at: new Date().toISOString()
        },
        delivery_method: vendorSystem,
        delivery_scope: vendorScope,
        assigned_delivery_system: vendorSystem,
        shipping_address: shippingAddress,
        paystack_reference: batchReference, // Reuse Paystack ref field as unique batch identifier
        expires_at: expiresAt.toISOString(),
        admin_discount: itemDiscount,
        delivery_code: deliveryCode,
        delivery_fee_charged: itemDeliveryFee,
        university_id: brandData?.university_id,
        is_preorder: item.is_preorder || false,
        preorder_arrival_date: item.preorder_arrival_date || null,
        variants_selected: item.variants_selected || {},
      };
    });

    const calculatedSubtotal = ordersToInsert.reduce((sum: number, o: any) => sum + Number(o.total_amount), 0);
    const totalDiscountApplied = ordersToInsert.reduce((sum: number, o: any) => sum + Number(o.admin_discount), 0);

    if (promoData && promoData.subsidiary_capital && Number(promoData.subsidiary_capital) > 0) {
      if (Number(promoData.capital_used) + totalDiscountApplied > Number(promoData.subsidiary_capital)) {
         return NextResponse.json({ error: 'PROMO_CAPITAL_EXHAUSTED', message: 'This promo code has exhausted its maximum budget and is no longer valid.' }, { status: 400 });
      }
    }

    // Insert manual orders directly
    let { error: orderError } = await supabaseAdmin.from('orders').insert(ordersToInsert);
    if (orderError) throw orderError;

    // Deduct stock levels immediately
    for (const item of items) {
      const liveProduct = liveProducts.find(p => p.id === item.productId);
      if (liveProduct && liveProduct.stock_count !== -1) {
        await supabaseAdmin
          .from('products')
          .update({ stock_count: Math.max(0, liveProduct.stock_count - item.quantity) })
          .eq('id', item.productId);
      }
    }

    return NextResponse.json({ 
      success: true, 
      reference: batchReference 
    });

  } catch (error: any) {
    console.error('Manual checkout error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

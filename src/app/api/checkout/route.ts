/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { initializeTransaction } from '@/lib/paystack';

export async function POST(req: Request) {
  // Default fallbacks
  const commissionRate = 0.075; 

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
        .select('id, title, brand_id, price, stock_count, brands(verified, fee_paid, delivery_scope, assigned_delivery_system)')
        .in('id', productIds),
      supabaseAdmin
        .from('users')
        .select('email')
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
    const promoData = promoResult?.data;

    if (!liveProducts || liveProducts.length === 0) {
      return NextResponse.json({ error: 'STALE_CART_ITEMS' }, { status: 400 });
    }

    // 1. Verify Brands activation status
    const inactiveBrands = liveProducts.filter((p: any) => !p.brands || (Array.isArray(p.brands) ? !p.brands[0].verified : !p.brands.verified));
    if (inactiveBrands.length > 0) {
       return NextResponse.json({ 
        error: 'INACTIVE_VENDORS', 
        message: 'A brand in your cart is currently offline. Please remove their items to proceed.' 
      }, { status: 400 });
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
    const settingsDeliveryFee = Number(settingsResult.data?.value?.delivery_base_fee) || 1500;
    
    let totalDeliveryFee = 0;
    if (hasPlatform) {
      totalDeliveryFee = hasOutSchool ? (settingsDeliveryFee * 2) : settingsDeliveryFee;
    }

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30);

    const ordersToInsert = items.map((item: { productId: string; quantity: number; price: number; brandId: string }, index: number) => {
      const liveProduct = liveProducts.find(p => p.id === item.productId);
      const originalPrice = liveProduct?.price || item.price;
      const isFirst = index === 0;
      
      const brandData = (Array.isArray(liveProduct?.brands) ? liveProduct.brands[0] : liveProduct?.brands) as any;
      
      const vendorScope = brandData?.delivery_scope || 'in-school';
      const vendorSystem = brandData?.assigned_delivery_system || 'platform';

      const baseItemSubtotal = originalPrice * (item.quantity || 1);
      
      // Calculate Discount (Paid by Admin)
      let itemDiscount = 0;
      if (promoData) {
          if (!promoData.product_id || promoData.product_id === item.productId) {
              if (promoData.type === 'percentage') {
                  itemDiscount = baseItemSubtotal * (Number(promoData.value) / 100);
              } else if (promoData.type === 'fixed') {
                  itemDiscount = index === 0 ? Number(promoData.value) : 0; 
              }
          }
      }

      const discountedItemSubtotal = Math.max(0, baseItemSubtotal - itemDiscount);
      // Only charge delivery fee on the FIRST item of the order batch if platform delivery is involved
      const itemDeliveryFee = isFirst ? totalDeliveryFee : 0;
      const finalItemTotal = discountedItemSubtotal + itemDeliveryFee;
      
      const baseCommission = baseItemSubtotal * commissionRate;
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

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { initializeTransaction } from '@/lib/paystack';

export async function POST(req: Request) {
  // Default fallbacks
  let commissionRate = 0.075; 
  let deliveryFee = 1500;

  try {
    const { userId, items, totalAmount, shippingAddress } = await req.json();

    if (!userId || !items || items.length === 0) {
      return NextResponse.json({ error: 'Invalid checkout payload' }, { status: 400 });
    }

    // 0. Parallel Fetching for speed (Verify items, User profile, and Platform Fees)
    const productIds = items.map((i: any) => i.productId);
    
    const [productsResult, profileResult, settingsResult] = await Promise.all([
      supabaseAdmin
        .from('products')
        .select('id, brand_id, price, stock_count, brands(verified, fee_paid)')
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
        .single()
    ]);

    const liveProducts = productsResult.data;
    const userProfile = profileResult.data;
    const fees = settingsResult.data?.value as any;

    if (fees) {
        deliveryFee = fees.delivery_fee || 1500;
        commissionRate = (fees.commission_rate || 7.5) / 100;
    }

    if (!liveProducts || liveProducts.length === 0) {
      return NextResponse.json({ error: 'STALE_CART_ITEMS' }, { status: 400 });
    }

    // 1. Verify Brands activation status
    const inactiveBrands = liveProducts.filter((p: any) => !p.brands?.verified || !p.brands?.fee_paid);
    if (inactiveBrands.length > 0) {
       return NextResponse.json({ 
        error: 'INACTIVE_VENDORS', 
        message: 'A brand in your cart is currently offline. Please remove their items to proceed.' 
      }, { status: 400 });
    }

    // 2. Validate Totals & Calculate Fees (Only Platform Delivery supported now)
    const deliveryMethod = 'platform';
    
    let calculatedSubtotal = 0;
    items.forEach((item: any) => {
      const live = liveProducts.find(p => p.id === item.productId);
      calculatedSubtotal += (live?.price || item.price) * (item.quantity || 1);
    });

    const finalChargeAmount = calculatedSubtotal + deliveryFee;
    const batchReference = `BATCH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30);

    const ordersToInsert = items.map((item: any, index: number) => {
      const liveProduct = liveProducts.find(p => p.id === item.productId);
      const price = liveProduct?.price || item.price;
      const isFirst = index === 0;
      
      const baseItemTotal = price * (item.quantity || 1);
      const itemDeliveryFee = isFirst ? deliveryFee : 0;
      const itemTotal = baseItemTotal + itemDeliveryFee;
      
      const baseCommission = baseItemTotal * commissionRate;
      const totalCommission = baseCommission + itemDeliveryFee; 
      const vendorEarning = baseItemTotal - baseCommission;

      return {
        customer_id: userId,
        brand_id: item.brandId,
        product_id: item.productId,
        quantity: item.quantity || 1,
        total_amount: itemTotal, 
        commission_amount: totalCommission,
        vendor_earning: vendorEarning,
        status: 'pending',
        delivery_method: deliveryMethod || 'platform',
        shipping_address: shippingAddress,
        paystack_reference: batchReference,
        expires_at: expiresAt.toISOString(),
      };
    });

    // 3. SECURE DATA PERSISTENCE: Save state before redirect
    const { error: orderError } = await supabaseAdmin.from('orders').insert(ordersToInsert);
    if (orderError) throw orderError;

    // 4. FAST REDIRECT: Initialize Paystack
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const host = req.headers.get('host') || 'abuadfashionhub.com';
    const baseDomain = host.includes('localhost') ? `${protocol}://${host}` : 'https://abuadfashionhub.com';
    const callbackUrl = `${baseDomain}/checkout/success?ref=${batchReference}`;

    const paystackData = await initializeTransaction({
      email: userProfile?.email || 'customer@abuadfashionhub.com',
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

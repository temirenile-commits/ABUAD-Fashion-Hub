import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { initializeTransaction } from '@/lib/paystack';

export async function POST(req: Request) {
  const commissionRate = 0.075; // 7.5% platform fee
  try {
    const { userId, items, totalAmount, shippingAddress, deliveryMethod } = await req.json();

    if (!userId || !items || items.length === 0) {
      return NextResponse.json({ error: 'Invalid checkout payload' }, { status: 400 });
    }

    // 0. Parallel Fetching for speed (Verify items and User profile)
    const productIds = items.map((i: any) => i.productId);
    
    const [productsResult, profileResult] = await Promise.all([
      supabaseAdmin
        .from('products')
        .select('id, brand_id, price, stock_count, brands(verified, fee_paid)')
        .in('id', productIds),
      supabaseAdmin
        .from('users')
        .select('email')
        .eq('id', userId)
        .single()
    ]);

    const liveProducts = productsResult.data;
    const userProfile = profileResult.data;

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

    // 2. Validate Totals & Calculate Fees
    const deliveryFee = deliveryMethod === 'platform' ? 1500 : 0;
    
    let calculatedSubtotal = 0;
    items.forEach((item: any) => {
      const live = liveProducts.find(p => p.id === item.productId);
      calculatedSubtotal += (live?.price || item.price) * (item.quantity || 1);
    });

    const finalChargeAmount = calculatedSubtotal + deliveryFee;
    const batchReference = `BATCH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

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
      };
    });

    // 3. SECURE DATA PERSISTENCE: Save state before redirect
    const { error: orderError } = await supabaseAdmin.from('orders').insert(ordersToInsert);
    if (orderError) throw orderError;

    // 4. FAST REDIRECT: Initialize Paystack
    const origin = req.headers.get('origin') || 'https://abuadfashionhub.com';
    // Ensure production always uses the primary domain for callbacks to avoid Vercel preview mismatch
    const baseDomain = origin.includes('localhost') ? origin : 'https://abuadfashionhub.com';
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

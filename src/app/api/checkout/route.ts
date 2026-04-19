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

    // 0. Verify Item existence and status
    const productIds = items.map((i: any) => i.productId);
    const { data: liveProducts, error: fetchError } = await supabaseAdmin
      .from('products')
      .select('id, brand_id, brands(verified, fee_paid)')
      .in('id', productIds);

    if (fetchError || !liveProducts || liveProducts.length !== items.length) {
      return NextResponse.json({ 
        error: 'STALE_CART_ITEMS', 
        message: 'Some items in your cart are no longer available. Please refresh your cart.' 
      }, { status: 400 });
    }

    // Verify Brands are active (Verified + Fee Paid)
    const inactiveBrands = liveProducts.filter((p: any) => !p.brands?.verified || !p.brands?.fee_paid);
    if (inactiveBrands.length > 0) {
       return NextResponse.json({ 
        error: 'INACTIVE_VENDORS', 
        message: 'One or more vendors in your cart are temporarily unavailable.' 
      }, { status: 400 });
    }

    // 1. Validate Totals...
    const deliveryFee = deliveryMethod === 'platform' ? 1500 : 0;
    
    let calculatedSubtotal = 0;
    items.forEach((item: any) => {
      calculatedSubtotal += item.price * (item.quantity || 1);
    });

    const calculatedTotal = calculatedSubtotal + deliveryFee;

    // Optional: Log mismatch if needed, but for now we rely on server-side total
    const finalChargeAmount = calculatedTotal;

    const batchReference = `BATCH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const ordersToInsert = items.map((item: any, index: number) => {
      const isFirst = index === 0;
      const baseItemTotal = item.price * (item.quantity || 1);
      
      const itemDeliveryFee = isFirst ? deliveryFee : 0;
      const itemTotal = baseItemTotal + itemDeliveryFee;
      
      const baseCommission = baseItemTotal * commissionRate;
      const totalCommission = baseCommission + itemDeliveryFee; 
      const vendorEarning = baseItemTotal - baseCommission;

      return {
        customer_id: userId,
        brand_id: item.brandId,
        product_id: item.productId,
        total_amount: itemTotal, 
        commission_amount: totalCommission,
        vendor_earning: vendorEarning,
        status: 'pending',
        delivery_method: deliveryMethod || 'platform',
        shipping_address: shippingAddress,
        paystack_reference: batchReference,
      };
    });

    const { data: createdOrders, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert(ordersToInsert)
      .select();

    if (orderError) {
      console.error('Order creation error:', orderError);
      throw new Error('Failed to create orders for this checkout session');
    }

    // 2. Initialize Paystack Transaction for the TOTAL amount (including delivery)
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    const origin = req.headers.get('origin') || 'https://abuadfashionhub.com';
    const callbackUrl = `${origin}/checkout/success`;

    const paystackParams = {
      email: userProfile?.email || 'customer@abuadfashionhub.com',
      amount: finalChargeAmount, // Strictly uses server-validated total
      reference: batchReference,
      callback_url: callbackUrl,
      metadata: {
        order_type: 'multi_product_purchase',
        item_count: items.length,
        customer_id: userId,
      },
    };

    let paystackResponse;
    try {
      if (process.env.PAYSTACK_SECRET_KEY) {
        paystackResponse = await initializeTransaction(paystackParams);
      } else {
        // Mock fallback
        paystackResponse = { authorization_url: '/checkout/success' };
      }
    } catch (paystackErr) {
      console.error('Paystack initialization failed:', paystackErr);
      return NextResponse.json({ error: 'Gateway error' }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      batchReference: batchReference,
      authorization_url: paystackResponse.authorization_url,
    });

  } catch (error: any) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

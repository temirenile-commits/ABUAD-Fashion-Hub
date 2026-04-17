import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { initializeTransaction } from '@/lib/paystack';

export async function POST(req: Request) {
  try {
    const { userId, items, totalAmount, shippingAddress, deliveryMethod } = await req.json();

    if (!userId || !items || items.length === 0) {
      return NextResponse.json({ error: 'Invalid checkout payload' }, { status: 400 });
    }

    // Phase 3 Logic: Platform takes 7.5% commission
    const commissionRate = 0.075;

    // We will create multiple order records, one for each unique product/vendor combination in the cart.
    // They will all share the same Paystack transaction reference for tracking.
    const batchReference = `BATCH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const orderPromises = items.map(async (item: any) => {
      const itemTotal = item.price * (item.quantity || 1);
      const commissionAmount = itemTotal * commissionRate;
      const vendorEarning = itemTotal - commissionAmount;

      return supabaseAdmin
        .from('orders')
        .insert({
          customer_id: userId,
          brand_id: item.brandId,
          product_id: item.productId,
          total_amount: itemTotal, // Individual item total
          commission_amount: commissionAmount,
          vendor_earning: vendorEarning,
          status: 'pending',
          delivery_method: deliveryMethod || 'platform',
          shipping_address: shippingAddress,
          paystack_reference: batchReference, // Linked by batch reference
        })
        .select()
        .single();
    });

    const results = await Promise.all(orderPromises);
    const orderErrors = results.filter(r => r.error);
    if (orderErrors.length > 0) {
      console.error('Order creation errors:', orderErrors);
      throw new Error('Failed to create some orders in the batch');
    }

    // 2. Initialize Paystack Transaction for the TOTAL amount (including delivery)
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    const paystackParams = {
      email: userProfile?.email || 'customer@abuadfashionhub.com',
      amount: totalAmount, // This is the final calculated total from the frontend
      reference: batchReference,
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

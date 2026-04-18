import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';

const secret = process.env.PAYSTACK_SECRET_KEY || '';

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-paystack-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    // Verify signature
    const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
    if (hash !== signature) {
      console.error('Invalid signatures matching');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(rawBody);

    if (event.event === 'charge.success') {
      const reference = event.data.reference;

      // 1. Fetch all orders with this Paystack reference
      const { data: orders, error: fetchError } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('paystack_reference', reference);

      if (fetchError || !orders || orders.length === 0) {
        console.error('No orders found for reference:', reference, fetchError);
        return NextResponse.json({ error: 'Orders not found' }, { status: 404 });
      }

      // 2. Update all these orders to 'paid' (Securing Escrow)
      const { error: updateError } = await supabaseAdmin
        .from('orders')
        .update({ status: 'paid' })
        .eq('paystack_reference', reference);

      if (updateError) {
        console.error('Error updating orders batch:', updateError);
        return NextResponse.json({ error: 'Batch update failed' }, { status: 500 });
      }

      // 3. Create transaction records for each order
      const transactionPromises = orders.map((order) => {
        return supabaseAdmin.from('transactions').insert({
          order_id: order.id,
          brand_id: order.brand_id,
          user_id: order.customer_id,
          type: 'payment_in',
          amount: order.total_amount,
          status: 'success',
          description: `Escrow payment secured for ${order.id.slice(0, 8)}`,
        });
      });

      await Promise.all(transactionPromises);

      console.log(`[WEBHOOK] ${orders.length} orders updated to 'paid' for reference ${reference}`);
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

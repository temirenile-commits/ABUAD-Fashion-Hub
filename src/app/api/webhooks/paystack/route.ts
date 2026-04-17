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
      const orderId = event.data.reference;
      
      // Update the order status to paid
      const { data: order, error } = await supabaseAdmin
        .from('orders')
        .update({ status: 'paid' })
        .eq('id', orderId)
        .select()
        .single();
        
      if (error) {
        console.error('Error updating order:', error);
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
      }

      // Create an inward transaction ledger record
      await supabaseAdmin.from('transactions').insert({
        order_id: orderId,
        brand_id: order.brand_id,
        user_id: order.customer_id,
        type: 'payment_in',
        amount: order.total_amount,
        status: 'success',
        description: 'Escrow payment secured via Paystack',
      });

      console.log(`[WEBHOOK] Order ${orderId} marked as PAiD. Escrow secured.`);
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

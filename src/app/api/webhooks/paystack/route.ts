import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyTransaction } from '@/lib/paystack';

const secret = process.env.PAYSTACK_SECRET_KEY || '';

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-paystack-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    // 1. Verify Signature (First Layer)
    const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
    if (hash !== signature) {
      console.error('Invalid signatures matching');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(rawBody);

    if (event.event === 'charge.success') {
      const reference = event.data.reference;

      // 2. Double Verification (Second Layer - Cross check with Paystack API)
      const verification = await verifyTransaction(reference);
      
      if (!verification.status || verification.data.status !== 'success') {
        console.error('Paystack verification failed for ref:', reference);
        return NextResponse.json({ error: 'Transaction verification failed' }, { status: 400 });
      }

      const metadata = verification.data.metadata || {};
      console.log(`[PAYSTACK WEBHOOK] Verified ${reference} successfully via API. Payment Type: ${metadata.payment_type}`);

      // Case A: Vendor Activation Fee
      if (metadata.payment_type === 'vendor_activation_fee') {
        const { brand_id } = metadata;
        const { error: brandUpdateError } = await supabaseAdmin
          .from('brands')
          .update({ 
            fee_paid: true, 
            verification_status: 'verified',
            verified: true 
          })
          .eq('id', brand_id);
        
        if (brandUpdateError) {
          console.error('Error activating brand:', brandUpdateError);
          return NextResponse.json({ error: 'Brand activation failed' }, { status: 500 });
        }
        
        console.log(`[WEBHOOK] Brand ${brand_id} activated successfully!`);
        return NextResponse.json({ status: 'success' }, { status: 200 });
      }

      // Case B: Customer Orders (Default)
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

      // 3. Process each order: Decrement stock, create notifications, and record transactions
      for (const order of orders) {
        // A. Get the brand owner's user ID for notifications
        const { data: brandData } = await supabaseAdmin
          .from('brands')
          .select('owner_id')
          .eq('id', order.brand_id)
          .single();
        const vendorUserId = brandData?.owner_id;

        // B. Decrement Stock
        await supabaseAdmin.rpc('decrement_product_stock', { 
          prod_id: order.product_id, 
          qty: 1 // Assuming 1 for now, or fetch from order if quantity is added
        });

        // B. Create Transaction record
        await supabaseAdmin.from('transactions').insert({
          order_id: order.id,
          brand_id: order.brand_id,
          user_id: order.customer_id,
          type: 'payment_in',
          amount: order.total_amount,
          status: 'success',
          description: `Escrow payment secured for order #${order.id.slice(0, 8)}`,
        });

        // C. Notify Buyer
        await supabaseAdmin.from('notifications').insert({
          user_id: order.customer_id,
          type: 'order_update',
          title: 'Order Confirmed! 🎉',
          content: `Your payment has been secured. The vendor is now preparing your order #${order.id.slice(0, 8)}.`,
          link: '/dashboard/customer',
          is_read: false
        });

        // D. Notify Vendor
        if (vendorUserId) {
          await supabaseAdmin.from('notifications').insert({
            user_id: vendorUserId,
            type: 'new_order',
            title: 'You have a new order! 💸',
            content: `A customer just purchased an item. Start processing order #${order.id.slice(0, 8)} to release your funds.`,
            link: '/dashboard/vendor',
            is_read: false
          });
        }
      }

      console.log(`[WEBHOOK] ${orders.length} orders processed successfully for reference ${reference}`);
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

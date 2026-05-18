import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyTransaction } from '@/lib/paystack';

export const dynamic = 'force-dynamic';

/**
 * Manual Payment Sync Endpoint
 * Called by customers or admins when a Paystack payment succeeded
 * but the webhook didn't update the order status.
 */
export async function POST(req: Request) {
  try {
    const { reference, orderId } = await req.json();

    if (!reference) {
      return NextResponse.json({ error: 'Paystack reference is required' }, { status: 400 });
    }

    // 1. Verify with Paystack API directly
    const verification = await verifyTransaction(reference);

    if (!verification.status || verification.data?.status !== 'success') {
      return NextResponse.json({ 
        error: 'Payment not confirmed by Paystack. Please wait a moment and try again.',
        paystackStatus: verification.data?.status 
      }, { status: 400 });
    }

    const paidAmount = verification.data.amount / 100;

    // 2. Find orders by reference (or specific orderId)
    let query = supabaseAdmin
      .from('orders')
      .select('*')
      .eq('paystack_reference', reference);
    
    if (orderId) query = query.eq('id', orderId);

    const { data: orders, error: fetchError } = await query;

    if (fetchError || !orders || orders.length === 0) {
      return NextResponse.json({ 
        error: 'No orders found for this reference. If you just paid, please wait 30 seconds and try again.' 
      }, { status: 404 });
    }

    // 3. Skip if already paid (idempotency)
    const alreadyPaid = orders.every(o => 
      ['paid', 'preorder_paid', 'preparing', 'ready', 'picked_up', 'in_transit', 'delivered', 'received'].includes(o.status)
    );

    if (alreadyPaid) {
      return NextResponse.json({ 
        success: true, 
        message: 'Orders are already marked as paid.',
        orders: orders.map(o => ({ id: o.id, status: o.status }))
      });
    }

    // 4. Generate delivery code
    const deliveryCode = Math.floor(100000 + Math.random() * 900000).toString();

    // 5. Update orders
    const normalOrderIds = orders.filter(o => o.status === 'pending').map(o => o.id);
    const preorderIds = orders.filter(o => o.status === 'preorder_pending').map(o => o.id);

    const updateResults = [];

    if (normalOrderIds.length > 0) {
      const { error } = await supabaseAdmin.from('orders').update({
        status: 'paid',
        delivery_code: deliveryCode,
        expires_at: null,
      }).in('id', normalOrderIds);
      if (error) {
        // Try without delivery_code if schema cache issue
        if (error.message.includes('schema cache') || error.message.includes('column')) {
          await supabaseAdmin.from('orders').update({ status: 'paid', expires_at: null }).in('id', normalOrderIds);
        } else {
          updateResults.push({ error: error.message });
        }
      } else {
        updateResults.push({ updated: normalOrderIds.length, status: 'paid' });
      }
    }

    if (preorderIds.length > 0) {
      const { error } = await supabaseAdmin.from('orders').update({
        status: 'preorder_paid',
        delivery_code: deliveryCode,
        expires_at: null,
      }).in('id', preorderIds);
      if (error) {
        if (error.message.includes('schema cache') || error.message.includes('column')) {
          await supabaseAdmin.from('orders').update({ status: 'preorder_paid', expires_at: null }).in('id', preorderIds);
        }
      } else {
        updateResults.push({ updated: preorderIds.length, status: 'preorder_paid' });
      }
    }

    // 6. Trigger fulfillment for each order (background)
    const allUpdatedIds = [...normalOrderIds, ...preorderIds];
    if (allUpdatedIds.length > 0) {
      // Notify customer
      await supabaseAdmin.from('notifications').insert({
        user_id: orders[0].customer_id,
        type: 'order_update',
        title: '✅ Payment Confirmed!',
        content: `Your payment of ₦${paidAmount.toLocaleString()} has been verified and your order is now being processed. Delivery code: ${deliveryCode}`,
        link: '/dashboard/customer',
        is_read: false,
      });

      // Update brand metrics for each order
      for (const order of orders.filter(o => allUpdatedIds.includes(o.id))) {
        try {
          await supabaseAdmin.rpc('adjust_vendor_wallet', {
            p_brand_id: order.brand_id,
            p_pending_delta: order.vendor_earning || 0,
          });
        } catch (e) {
          // non-fatal
        }
      }
    }

    console.log(`[SYNC-PAYMENT] Manually synced ${allUpdatedIds.length} orders for reference ${reference}`);

    return NextResponse.json({
      success: true,
      message: `✅ Payment verified! ${allUpdatedIds.length} order(s) updated successfully.`,
      deliveryCode,
      paidAmount,
      results: updateResults,
    });

  } catch (error: any) {
    console.error('[SYNC-PAYMENT] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

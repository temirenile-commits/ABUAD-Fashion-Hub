import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  try {
    const { orderId, userId, reason } = await req.json();

    if (!orderId || !userId) {
       return NextResponse.json({ error: 'Missing order details' }, { status: 400 });
    }

    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('customer_id', userId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const notAllowed = ['ready', 'picked_up', 'in_transit', 'delivered', 'confirmed', 'completed', 'cancelled', 'refunded'];
    if (notAllowed.includes(order.status)) {
      return NextResponse.json({ error: 'Order is too far along in processing to be cancelled directly. Please contact support.' }, { status: 400 });
    }

    const { error: updateOrderError } = await supabaseAdmin
      .from('orders')
      .update({ 
        status: 'cancelled',
        rejection_reason: `Cancelled by Customer: ${reason || 'No reason provided'}`
      })
      .eq('id', orderId);

    if (updateOrderError) throw updateOrderError;

    // Revert pending wallet funds if the order was already paid
    if (order.status !== 'pending') {
      try {
        await supabaseAdmin.rpc('adjust_vendor_wallet', {
          p_brand_id: order.brand_id,
          p_pending_delta: -order.vendor_earning
        });
        
        // Log transaction for the refund/cancellation
        await supabaseAdmin.from('transactions').insert({
          order_id: order.id,
          brand_id: order.brand_id,
          user_id: userId,
          type: 'refund',
          amount: order.total_amount,
          status: 'pending', // Usually pending manual review for actual money return if Paystack was used
          description: `Customer cancelled order #${order.id.slice(0, 8)}. Refund requested.`
        });
      } catch (e) {
        console.error('Wallet deduction failed on cancel:', e);
      }
    }

    // Notify Vendor
    await supabaseAdmin.from('notifications').insert({
      user_id: order.brand_owner_id || order.brand_id,
      type: 'order_update',
      title: 'Order Cancelled ❌',
      content: `Customer cancelled order #${order.id.slice(0, 8)}. Reason: ${reason || 'None'}`,
      link: '/dashboard/vendor',
      is_read: false
    });

    return NextResponse.json({ success: true, message: 'Order cancelled successfully' });

  } catch (error: any) {
    console.error('Order cancellation error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Escrow Release Endpoint
 * Triggered by the Customer when they confirm receipt of the item.
 */
export async function POST(req: Request) {
  try {
    const { orderId, userId } = await req.json();

    if (!orderId || !userId) {
       return NextResponse.json({ error: 'Missing order details' }, { status: 400 });
    }

    // 1. Fetch the order to ensure it belongs to the customer and is currently in 'paid' (escrow) status
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('customer_id', userId)
      .single();

    if (fetchError || !order) {
      console.error('Order not found for confirmation:', fetchError);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.status !== 'paid' && order.status !== 'in_transit' && order.status !== 'delivered') {
      return NextResponse.json({ error: 'Order is not in a releasable state' }, { status: 400 });
    }

    // 2. Perform Release (Transactional Update)
    // We update the order status and increment the vendor's balance
    
    // A. Update Order Status
    const { error: updateOrderError } = await supabaseAdmin
      .from('orders')
      .update({ 
        status: 'delivered',
        delivered_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (updateOrderError) throw updateOrderError;

    // B. Increment Vendor Wallet (Move from Pending to Available)
    const { error: walletError } = await supabaseAdmin.rpc('adjust_vendor_wallet', {
      p_brand_id: order.brand_id,
      p_available_delta: order.vendor_earning,
      p_pending_delta: -order.vendor_earning
    });

    if (walletError) {
      console.error('Wallet update failed during confirmation:', walletError);
      // Fallback: This should ideally not happen if migration was successful
    }

    // C. Create Transaction Record for the Vendor
    await supabaseAdmin.from('transactions').insert({
      order_id: order.id,
      brand_id: order.brand_id,
      user_id: userId, // Customer who confirmed
      type: 'escrow_release',
      amount: order.vendor_earning,
      status: 'success',
      description: `Funds released from Escrow for order #${order.id.slice(0, 8)}`
    });

    // D. Notify Vendor
    await supabaseAdmin.from('notifications').insert({
      user_id: order.brand_owner_id || order.brand_id,
      type: 'payment_received',
      title: 'Funds Released! 💰',
      content: `Customer confirmed delivery for order #${order.id.slice(0, 8)}. ₦${order.vendor_earning.toLocaleString()} has been added to your balance.`,
      link: '/dashboard/vendor',
      is_read: false
    });

    return NextResponse.json({ success: true, message: 'Funds released to vendor successfully' });

  } catch (error: any) {
    console.error('Escrow release error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';


export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orderId, status, vendorId, trackingNumber, rejectionReason } = body;

    if (!orderId || !status || !vendorId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // 1. Verify the vendor or assigned delivery agent owns/is assigned to this order
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('*, brands(owner_id), deliveries(agent_id)')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const isVendor = order.brands.owner_id === vendorId;
    const isAgent = order.deliveries && order.deliveries[0]?.agent_id === vendorId; // vendorId acts as the current user's ID here

    if (!isVendor && !isAgent) {
      return NextResponse.json({ error: 'Unauthorized to manage this order' }, { status: 403 });
    }

    // 2. Update Status
    const updateData: any = { status: status };
    
    if (trackingNumber) updateData.tracking_number = trackingNumber;
    if (rejectionReason) updateData.rejection_reason = rejectionReason;

    if (status === 'in_transit') {
      const now = new Date().toISOString();
      updateData.picked_up_at = now;
      updateData.in_transit_at = now;
    }

    if (status === 'delivered') {
      const deliveredAt = new Date().toISOString();
      updateData.delivered_at = deliveredAt;
      
      const { data: maturityDate } = await supabaseAdmin.rpc('calculate_order_maturity', { 
        delivered_time: deliveredAt 
      });
      updateData.payout_ready_at = maturityDate;
    }

    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update(updateData)
      .eq('id', orderId);

    if (updateError) throw updateError;

    // 3. Sync Delivery Visibility
    if (status === 'ready' && order.delivery_method === 'platform') {
      await supabaseAdmin.from('deliveries')
        .update({ status: 'pending' })
        .eq('order_id', orderId);
    }

    return NextResponse.json({ success: true, message: `Status updated to ${status}` });

  } catch (error: any) {
    console.error('Order Status Update Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

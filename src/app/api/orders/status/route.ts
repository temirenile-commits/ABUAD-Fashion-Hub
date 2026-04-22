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

    // 1. Verify the vendor owns this order
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('*, brands(owner_id)')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.brands.owner_id !== vendorId) {
      return NextResponse.json({ error: 'Unauthorized to manage this order' }, { status: 403 });
    }

    // 2. Update Status
    const updateData: any = { status: status };
    
    if (trackingNumber) updateData.tracking_number = trackingNumber;
    if (rejectionReason) updateData.rejection_reason = rejectionReason;

    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update(updateData)
      .eq('id', orderId);

    if (updateError) throw updateError;

    // 3. (Optional) Create delivery record if status is marked as 'ready' for platform
    if (status === 'ready' && order.delivery_method === 'platform') {
      await supabaseAdmin.from('deliveries').upsert({
        order_id: orderId,
        tracking_updates: JSON.stringify([{ status: 'ready', time: new Date() }])
      });
    }

    return NextResponse.json({ success: true, message: `Status updated to ${status}` });

  } catch (error: any) {
    console.error('Order Status Update Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

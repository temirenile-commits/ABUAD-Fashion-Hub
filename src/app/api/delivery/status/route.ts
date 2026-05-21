import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  try {
    const { deliveryId, status, agentId } = await req.json();

    if (!deliveryId || !status || !agentId) {
       return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Verify Agent Ownership
    const { data: delivery, error: fetchError } = await supabaseAdmin
      .from('deliveries')
      .select('*, orders(*, brands(*))')
      .eq('id', deliveryId)
      .eq('agent_id', agentId)
      .single();

    if (fetchError || !delivery) {
      return NextResponse.json({ error: 'Delivery not found or unauthorized' }, { status: 404 });
    }

    // 2. Update Delivery Table
    let updateData: any = { status };
    if (status === 'picked_up') {
      updateData.picked_up_at = new Date().toISOString();
    } else if (status === 'transfer') {
      // Release agent lock and push back to public available pool
      updateData = {
        status: 'pending',
        agent_id: null,
        agent_name: null,
        agent_phone: null,
      };
    }

    const { error: deliveryError } = await supabaseAdmin
      .from('deliveries')
      .update(updateData)
      .eq('id', deliveryId);

    if (deliveryError) throw deliveryError;

    // 3. Sync with Orders Table (only if not a transfer back to pool)
    if (delivery.order_id && status !== 'transfer') {
       const orderStatus = status === 'picked_up' ? 'in_transit' : status;
       const orderUpdateData: { status: string; picked_up_at?: string; in_transit_at?: string } = { status: orderStatus };
       if (status === 'picked_up') {
          orderUpdateData.picked_up_at = updateData.picked_up_at;
          orderUpdateData.in_transit_at = updateData.picked_up_at;
       }

       await supabaseAdmin.from('orders').update(orderUpdateData).eq('id', delivery.order_id);
    }

    // 4. Notify Customer & Vendor (if picked up) OR notify other agents (if transferred)
    if (status === 'picked_up' && delivery.orders) {
       const notifs = [
          {
            user_id: delivery.orders.customer_id,
            title: 'Order Picked Up! 🛵',
            content: `Your order #${delivery.orders.id.slice(0,8)} is now on the way. Check your dashboard for delivery agent details.`,
            is_read: false
          },
          {
            user_id: delivery.orders.brand_owner_id || delivery.orders.brand_id, // Fallback
            title: 'Order Picked Up! 🛵',
            content: `A delivery agent has picked up order #${delivery.orders.id.slice(0,8)}.`,
            is_read: false
          }
       ];
       await supabaseAdmin.from('notifications').insert(notifs);
    } else if (status === 'transfer' && delivery.orders) {
       // Notify active agents in the university about the transferred order
       const uniId = delivery.orders.university_id ?? delivery.orders.brands?.university_id;
       if (uniId) {
          const { data: agents } = await supabaseAdmin
            .from('delivery_agents')
            .select('id')
            .eq('university_id', uniId)
            .eq('is_active', true)
            .neq('id', agentId);

          if (agents && agents.length > 0) {
             await supabaseAdmin.from('notifications').insert(
                agents.map((a: { id: string }) => ({
                   user_id: a.id,
                   title: '📦 Order Transferred to Public Console',
                   content: `An order at ${(delivery.orders as any).brands?.name || 'vendor'} has been transferred to public logistics and is ready to claim.`,
                   link: '/dashboard/delivery',
                   type: 'direct',
                   is_read: false,
                }))
             );
          }
       }
    }

    return NextResponse.json({ success: true });

  } catch (error: unknown) {
    console.error('Delivery Status Update Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// This endpoint should be called daily by a cron job (e.g. Vercel Cron or GitHub Actions)
export async function GET(req: Request) {
  try {
    // Basic authorization could be added here if needed, 
    // e.g. checking an Authorization header against a CRON_SECRET

    // 1. Find all active platform deliveries that are waiting for an agent
    const { data: waitingDeliveries, error: fetchError } = await supabaseAdmin
      .from('deliveries')
      .select('id, order_id, created_at')
      .eq('status', 'waiting_for_agent');

    if (fetchError) throw fetchError;

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    const expiredDeliveries = [];
    const expiredOrderIds = [];

    // 1. Cancel deliveries not picked up within the allowed time
    for (const delivery of waitingDeliveries || []) {
      let { data: order, error: orderFetchError } = await supabaseAdmin
        .from('orders')
        .select('is_preorder, preorder_arrival_date, delivery_scope')
        .eq('id', delivery.order_id)
        .single();

      if (orderFetchError && orderFetchError.message.includes('schema cache')) {
        // Fallback if preorder columns are missing
        const fallback = await supabaseAdmin
          .from('orders')
          .select('delivery_scope')
          .eq('id', delivery.order_id)
          .single();
        order = fallback.data as any;
      }

      let targetDate = new Date(delivery.created_at);

      // If it's a preorder, the countdown starts from the arrival date
      if (order?.is_preorder && order?.preorder_arrival_date) {
        const arrivalDate = new Date(order.preorder_arrival_date);
        if (arrivalDate > targetDate) {
          targetDate = arrivalDate;
        }
      }

      // External deliveries (out-school) get 5 days, internal (in-school) get 3 days
      const isExternal = order?.delivery_scope === 'out-school';
      const expiryThreshold = isExternal ? fiveDaysAgo : threeDaysAgo;

      if (targetDate < expiryThreshold) {
        expiredDeliveries.push(delivery.id);
        expiredOrderIds.push(delivery.order_id);
      }
    }

    if (expiredDeliveries.length > 0) {
      // Mark deliveries as cancelled
      await supabaseAdmin
        .from('deliveries')
        .update({ status: 'cancelled' })
        .in('id', expiredDeliveries);

      // Update order status to 'cancelled_delivery'
      await supabaseAdmin
        .from('orders')
        .update({ status: 'cancelled_delivery' })
        .in('id', expiredOrderIds);
        
      console.log(`Cancelled ${expiredDeliveries.length} deliveries due to timeout.`);
    }

    // 2. Find deliveries picked up by an agent but not delivered within allowed time
    const { data: activeDeliveries, error: fetchActiveError } = await supabaseAdmin
      .from('deliveries')
      .select('id, order_id, picked_up_at')
      .eq('status', 'picked_up');
      
    if (fetchActiveError) throw fetchActiveError;
    
    const overdueDeliveries = [];
    const overdueOrderIds = [];
    
    for (const delivery of activeDeliveries || []) {
      if (delivery.picked_up_at) {
        const { data: order } = await supabaseAdmin
          .from('orders')
          .select('delivery_scope')
          .eq('id', delivery.order_id)
          .single();

        const isExternal = order?.delivery_scope === 'out-school';
        const expiryThreshold = isExternal ? fiveDaysAgo : threeDaysAgo;
        const pickedUpDate = new Date(delivery.picked_up_at);

        if (pickedUpDate < expiryThreshold) {
          overdueDeliveries.push(delivery.id);
          overdueOrderIds.push(delivery.order_id);
        }
      }
    }
    
    if (overdueDeliveries.length > 0) {
      await supabaseAdmin
        .from('deliveries')
        .update({ status: 'failed_delivery' })
        .in('id', overdueDeliveries);

      await supabaseAdmin
        .from('orders')
        .update({ status: 'failed_delivery' })
        .in('id', overdueOrderIds);
        
      console.log(`Marked ${overdueDeliveries.length} deliveries as failed (timeout after pickup).`);
    }

    return NextResponse.json({ 
      success: true, 
      cancelledWaiting: expiredDeliveries.length,
      failedActive: overdueDeliveries.length
    });

  } catch (error: any) {
    console.error('Cron Delivery error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

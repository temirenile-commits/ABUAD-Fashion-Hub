import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('[AUTO-REPAIR] Starting comprehensive logistics data repair and sync scan...');

    // 1. Fetch all orders with delivery_method = 'platform' that are paid or active in prep/pickup stages
    const { data: activeOrders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select('*, brands(university_id)')
      .eq('delivery_method', 'platform')
      .in('status', ['paid', 'accepted', 'processing', 'ready', 'ready_for_pickup', 'preorder_paid']);

    if (ordersError) {
      throw ordersError;
    }

    if (!activeOrders || activeOrders.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active platform orders found in the system. Everything is in sync!',
        processedCount: 0
      });
    }

    const repairs: string[] = [];
    let createdCount = 0;
    let updatedCount = 0;

    for (const order of activeOrders) {
      // Check if delivery row exists
      const { data: existingDelivery } = await supabaseAdmin
        .from('deliveries')
        .select('*')
        .eq('order_id', order.id)
        .maybeSingle();

      const orderUniId = order.university_id || order.brands?.university_id;
      
      // Fetch dynamic rider payout from university config
      let riderPayout = 500;
      if (orderUniId) {
        const { data: uniConfigData } = await supabaseAdmin
          .from('platform_settings')
          .select('value')
          .eq('key', `uni_config_${orderUniId}`)
          .maybeSingle();
        if (uniConfigData && (uniConfigData.value as any)?.delivery_rider_pay) {
          riderPayout = Number((uniConfigData.value as any).delivery_rider_pay);
        }
      }

      // If no delivery row exists, create it
      if (!existingDelivery) {
        const initialStatus = ['paid', 'preorder_paid'].includes(order.status)
          ? 'waiting_for_vendor'
          : 'pending';

        const { error: insertError } = await supabaseAdmin
          .from('deliveries')
          .insert({
            order_id: order.id,
            status: initialStatus,
            delivery_fee: riderPayout
          });

        if (!insertError) {
          createdCount++;
          repairs.push(`Created new delivery row for Order #${order.id.slice(0, 8)} with status ${initialStatus} and fee ₦${riderPayout}`);
        } else {
          console.error(`[AUTO-REPAIR] Failed to insert delivery row for Order #${order.id}:`, insertError);
        }
      } else {
        // If delivery row exists but is still 'waiting_for_vendor' when order is accepted/processing/ready
        if (existingDelivery.status === 'waiting_for_vendor' && ['accepted', 'processing', 'ready', 'ready_for_pickup'].includes(order.status)) {
          const { error: updateError } = await supabaseAdmin
            .from('deliveries')
            .update({ status: 'pending' })
            .eq('id', existingDelivery.id);

          if (!updateError) {
            updatedCount++;
            repairs.push(`Updated existing delivery row for Order #${order.id.slice(0, 8)} status from waiting_for_vendor to pending`);
          } else {
            console.error(`[AUTO-REPAIR] Failed to update delivery status for Order #${order.id}:`, updateError);
          }
        }

        // Keep delivery_fee updated dynamically if it was null/missing
        if (!existingDelivery.delivery_fee) {
          await supabaseAdmin
            .from('deliveries')
            .update({ delivery_fee: riderPayout })
            .eq('id', existingDelivery.id);
        }
      }
    }

    console.log(`[AUTO-REPAIR] Scan complete. Created: ${createdCount}, Updated: ${updatedCount}`);

    return NextResponse.json({
      success: true,
      message: `Scanned and synchronized all active platform orders successfully.`,
      summary: {
        totalActivePlatformOrders: activeOrders.length,
        newDeliveriesCreated: createdCount,
        deliveriesUpdatedToPending: updatedCount
      },
      repairs
    });

  } catch (error: any) {
    console.error('[AUTO-REPAIR] Comprehensive scan error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to complete comprehensive logistics synchronization scan'
    }, { status: 500 });
  }
}

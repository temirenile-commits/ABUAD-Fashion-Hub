import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';


export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orderId, status, vendorId, trackingNumber, rejectionReason, forwardToPublic } = body;

    if (!orderId || !status || !vendorId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // 1. Verify the vendor or assigned delivery agent owns/is assigned to this order
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('*, brands(owner_id, university_id, marketplace_type), deliveries(agent_id)')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const isVendor = order.brands.owner_id === vendorId;
    const isAgent = order.deliveries && order.deliveries[0]?.agent_id === vendorId;

    if (!isVendor && !isAgent) {
      return NextResponse.json({ error: 'Unauthorized to manage this order' }, { status: 403 });
    }

    // 2a. Guard: validate status transitions to prevent DB constraint violations
    const currentStatus = order.status;
    const validTransitions: Record<string, string[]> = {
      paid:             ['accepted', 'cancelled'],
      preorder_paid:    ['ready_for_pickup', 'cancelled'],
      accepted:         ['processing', 'ready_for_pickup', 'cancelled'],
      processing:       ['ready', 'ready_for_pickup', 'cancelled'],
      ready:            ['ready_for_pickup', 'in_transit', 'cancelled'],
      ready_for_pickup: ['in_transit', 'cancelled'],
      in_transit:       ['delivered', 'cancelled'],
      picked_up:        ['in_transit', 'delivered'],
    };
    const allowed = validTransitions[currentStatus];
    if (allowed && !allowed.includes(status)) {
      return NextResponse.json(
        { error: `Cannot move order from "${currentStatus}" to "${status}". ${currentStatus === 'pending' ? 'This order has not been paid yet.' : `Valid next steps are: ${allowed.join(', ')}.`}` },
        { status: 400 }
      );
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

    // 3. Sync Delivery Visibility — UPSERT delivery record when vendor marks ready
    // This fires for BOTH 'ready' and 'ready_for_pickup', regardless of original delivery_method,
    // because the vendor explicitly requested platform logistics.
    if (['ready', 'ready_for_pickup'].includes(status)) {
      // Force delivery_method to 'platform' so the entire pipeline aligns correctly
      await supabaseAdmin
        .from('orders')
        .update({ delivery_method: 'platform' })
        .eq('id', orderId);

      // Fetch university config for rider payout
      let riderPayout = 500;
      const uniId = order.university_id ?? order.brands?.university_id;
      if (uniId) {
        const { data: uniConfigData } = await supabaseAdmin
          .from('platform_settings')
          .select('value')
          .eq('key', `uni_config_${uniId}`)
          .single();
        if (uniConfigData && (uniConfigData.value as any)?.delivery_rider_pay) {
          riderPayout = Number((uniConfigData.value as any).delivery_rider_pay);
        }
      }

      // Check if the vendor (brand owner) is ALSO a delivery agent — auto-assign if so
      const vendorOwnerId = order.brands?.owner_id ?? vendorId;
      const { data: vendorAsAgent } = await supabaseAdmin
        .from('delivery_agents')
        .select('id')
        .eq('id', vendorOwnerId)
        .eq('is_active', true)
        .maybeSingle();

      const shouldAutoAssign = vendorAsAgent && !forwardToPublic;

      // Check if a delivery record already exists for this order
      const { data: existingDelivery } = await supabaseAdmin
        .from('deliveries')
        .select('id, status')
        .eq('order_id', orderId)
        .maybeSingle();

      if (existingDelivery) {
        // UPDATE: promote to pending or assign to vendor-agent
        const deliveryUpdate: any = { status: 'pending' };
        if (shouldAutoAssign) {
          deliveryUpdate.agent_id = vendorOwnerId;
          deliveryUpdate.status = 'assigned';
          console.log(`[LOGISTICS] Auto-assigning order ${orderId} to vendor-agent ${vendorOwnerId}`);
        } else {
          deliveryUpdate.agent_id = null;
          deliveryUpdate.agent_name = null;
          deliveryUpdate.agent_phone = null;
        }
        await supabaseAdmin
          .from('deliveries')
          .update(deliveryUpdate)
          .eq('id', existingDelivery.id);
      } else {
        // INSERT: create the delivery record that was never created at checkout
        const deliveryInsert: any = {
          order_id: orderId,
          status: shouldAutoAssign ? 'assigned' : 'pending',
          delivery_fee: riderPayout,
        };
        if (shouldAutoAssign) {
          deliveryInsert.agent_id = vendorOwnerId;
          console.log(`[LOGISTICS] Creating + auto-assigning delivery for order ${orderId} to vendor-agent ${vendorOwnerId}`);
        }
        const { error: insertErr } = await supabaseAdmin
          .from('deliveries')
          .insert(deliveryInsert);
        if (insertErr) {
          console.error('[LOGISTICS] Failed to insert delivery record:', insertErr);
        } else {
          console.log(`[LOGISTICS] Created delivery record for order ${orderId} (status: ${deliveryInsert.status})`);
        }
      }

      // Notify delivery agents in this university (skip if auto-assigned to vendor)
      if (!shouldAutoAssign && uniId) {
        try {
          const { data: agents } = await supabaseAdmin
            .from('delivery_agents')
            .select('id')
            .eq('university_id', uniId)
            .eq('is_active', true);

          if (agents && agents.length > 0) {
            await supabaseAdmin.from('notifications').insert(
              agents.map((a: { id: string }) => ({
                user_id: a.id,
                title: '📦 New Pickup Ready!',
                content: `An order is ready for pickup. Open your Dispatch Console to claim it.`,
                link: '/dashboard/delivery',
                type: 'direct',
                is_read: false,
              }))
            );
          }
        } catch (notifErr) {
          console.error('[NOTIFY-AGENTS] Failed to notify delivery agents:', notifErr);
        }
      }
    }


    // 4. AUTO PAYOUT RECORD: Create financial record when order is delivered
    if (status === 'delivered') {
      try {
        const grossAmount = Number(order.total_amount) || 0;
        const commissionDeduction = Number(order.commission_amount) || 0;
        const promoDeduction = Number(order.admin_discount) || 0;
        const deliveryFeeAllocation = Number(order.delivery_fee_charged) || 0;
        const vendorEarning = Number(order.vendor_earning) || 0;

        // Net payout = what we owe the vendor (already pre-calculated at checkout)
        const netPayout = vendorEarning;

        const calculationNotes = [
          `Gross Order Value: ₦${grossAmount.toLocaleString()}`,
          `Platform Commission (${((commissionDeduction / grossAmount) * 100).toFixed(1)}%): -₦${commissionDeduction.toLocaleString()}`,
          promoDeduction > 0 ? `Promo Discount Absorbed: -₦${promoDeduction.toLocaleString()}` : null,
          deliveryFeeAllocation > 0 ? `Delivery Fee (not vendor's): -₦${deliveryFeeAllocation.toLocaleString()}` : null,
          `Net Vendor Payout: ₦${netPayout.toLocaleString()}`,
        ].filter(Boolean).join(' | ');

        await supabaseAdmin.rpc('create_payout_record', {
          p_order_id: orderId,
          p_brand_id: order.brand_id,
          p_university_id: order.university_id || order.brands?.university_id || null,
          p_gross_amount: grossAmount,
          p_commission_deduction: commissionDeduction,
          p_promo_deduction: promoDeduction,
          p_delivery_fee_allocation: deliveryFeeAllocation,
          p_net_payout: netPayout,
          p_product_section: order.brands?.marketplace_type || 'fashion',
          p_calculation_notes: calculationNotes,
        });

        console.log(`[PAYOUT ENGINE] Created payout record for order ${orderId}: ₦${netPayout}`);
      } catch (payoutErr) {
        // Non-fatal: log but don't block the status update from completing
        console.error('[PAYOUT ENGINE] Failed to create payout record:', payoutErr);
      }

      try {
        const { error: referralError } = await supabaseAdmin.rpc('process_referral_order', { p_order_id: orderId });
        if (referralError) console.error('[REFERRAL] Order reward processing failed:', referralError.message);
      } catch (referralErr) {
        console.error('[REFERRAL] Order reward processing failed:', referralErr);
      }
    }

    // 5. Notify customer of the status change
    try {
      const statusMessages: Record<string, { title: string; content: string }> = {
        accepted:         { title: '✅ Order Accepted!',       content: 'Your order has been accepted by the vendor and is being prepared.' },
        processing:       { title: '👨‍🍳 Order Being Prepared',  content: 'The vendor is now preparing your order.' },
        ready:            { title: '📦 Ready for Pickup',      content: 'Your order is ready and awaiting a delivery agent.' },
        ready_for_pickup: { title: '📦 Ready for Pickup',      content: 'Your order is ready and awaiting a delivery agent.' },
        picked_up:        { title: '🛵 Order Picked Up',       content: 'A delivery agent has picked up your order.' },
        in_transit:       { title: '🚀 Order On the Way!',     content: 'Your order is on its way to you. Get ready!' },
        delivered:        { title: '🎉 Order Delivered!',      content: 'Your order has been delivered. Please confirm receipt in your dashboard.' },
        cancelled:        { title: '❌ Order Cancelled',        content: `Your order was cancelled.${order.rejection_reason ? ` Reason: ${order.rejection_reason}` : ''}` },
      };

      const notif = statusMessages[status];
      if (notif && order.customer_id) {
        await supabaseAdmin.from('notifications').insert({
          user_id: order.customer_id,
          title: notif.title,
          content: notif.content,
          link: `/track/${orderId}`,
          type: 'direct',
          is_read: false,
        });
      }
    } catch (notifErr) {
      // Non-fatal
      console.error('[NOTIFY] Failed to send customer notification:', notifErr);
    }

    return NextResponse.json({ success: true, message: `Status updated to ${status}` });

  } catch (error: any) {
    console.error('Order Status Update Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

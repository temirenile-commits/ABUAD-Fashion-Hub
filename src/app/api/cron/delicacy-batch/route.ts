import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Cron job — runs every 30 minutes
// Groups pending delicacy orders into batches and assigns to available agents
export async function GET() {
  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 30 * 60 * 1000); // 30 min ago

    // 1. Find open pending delicacy orders in the last 30-min window
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select('id, university_id, product_id, products(delicacy_category)')
      .eq('status', 'paid')
      .is('batch_id', null)
      .gte('created_at', windowStart.toISOString())
      .lte('created_at', now.toISOString());

    if (ordersError) throw ordersError;
    if (!orders || orders.length === 0) {
      return NextResponse.json({ message: 'No pending delicacy orders to batch', batches: 0 });
    }

    // 2. Group orders by university + category
    const groups: Record<string, { universityId: string; category: string; orderIds: string[] }> = {};

    for (const order of orders) {
      const product = Array.isArray(order.products) ? order.products[0] : order.products;
      const category = product?.delicacy_category || 'other';
      const key = `${order.university_id}-${category}`;

      if (!groups[key]) {
        groups[key] = { universityId: order.university_id, category, orderIds: [] };
      }
      groups[key].orderIds.push(order.id);
    }

    let batchesCreated = 0;

    for (const group of Object.values(groups)) {
      // 3. Find available delicacies agent for this university (prefer specialist, fallback general)
      const { data: agents } = await supabaseAdmin
        .from('delivery_agents')
        .select('id, specialization')
        .eq('university_id', group.universityId)
        .eq('is_active', true)
        .order('specialization', { ascending: false }) // 'general' < 'delicacies', so specialist first
        .limit(1);

      const agent = agents?.[0] ?? null;

      // 4. Create batch record
      const { data: batch, error: batchError } = await supabaseAdmin
        .from('delicacy_orders_batch')
        .insert({
          university_id: group.universityId,
          delicacy_category: group.category,
          batch_window_start: windowStart.toISOString(),
          batch_window_end: now.toISOString(),
          assigned_agent_id: agent?.id ?? null,
          order_ids: group.orderIds,
          status: agent ? 'assigned' : 'open',
        })
        .select('id')
        .single();

      if (batchError) {
        console.error('Batch creation error:', batchError);
        continue;
      }

      // 5. Tag each order with the batch id
      await supabaseAdmin
        .from('orders')
        .update({ batch_id: batch.id })
        .in('id', group.orderIds);

      batchesCreated++;
    }

    return NextResponse.json({ message: `Created ${batchesCreated} batch(es)`, batchesCreated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    console.error('Delicacy batch cron error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

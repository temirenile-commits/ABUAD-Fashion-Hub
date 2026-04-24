import { supabaseAdmin } from './supabase-admin';

/**
 * Calculates distance between two points in km (Haversine formula)
 */
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; 
  return d;
}

/**
 * Automatically assigns a delivery to the nearest active agent
 */
export async function autoAssignDelivery(orderId: string, vendorLat: number, vendorLong: number) {
  try {
    // 1. Fetch all active agents
    const { data: agents, error } = await supabaseAdmin
      .from('delivery_agents')
      .select('*, deliveries!left(id)')
      .eq('is_active', true);

    if (error || !agents || agents.length === 0) {
      console.log(`[LOGISTICS] No active agents found for order ${orderId}`);
      return null;
    }

    // 2. Filter agents who are within their batch capacity
    const availableAgents = agents.filter(agent => {
      const activeDeliveriesCount = (agent.deliveries || []).length;
      return activeDeliveriesCount < (agent.batch_capacity || 10);
    });

    if (availableAgents.length === 0) {
      console.log(`[LOGISTICS] All active agents are at full capacity.`);
      return null;
    }

    // 3. Find the nearest agent
    let nearestAgent = availableAgents[0];
    let minDistance = Infinity;

    availableAgents.forEach(agent => {
      if (agent.current_lat && agent.current_long) {
        const dist = getDistance(vendorLat, vendorLong, agent.current_lat, agent.current_long);
        if (dist < minDistance) {
          minDistance = dist;
          nearestAgent = agent;
        }
      }
    });

    // 4. Assign the delivery
    const pickupCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const deliveryCode = Math.random().toString(10).substring(2, 8); // 6-digit numeric

    const { data: assignment, error: assignError } = await supabaseAdmin
      .from('deliveries')
      .update({
        agent_id: nearestAgent.id,
        status: 'assigned',
        pickup_code: pickupCode,
        delivery_code: deliveryCode,
        assigned_at: new Date().toISOString()
      })
      .eq('order_id', orderId)
      .select()
      .single();

    if (assignError) throw assignError;

    // 5. Notify the agent (Optional: could add to notifications table)
    await supabaseAdmin.from('notifications').insert({
        user_id: nearestAgent.id,
        type: 'new_order',
        title: 'New Delivery Assigned! 📦',
        content: `You have a new pickup at ${minDistance.toFixed(2)}km away.`,
        link: '/dashboard/delivery'
    });

    return assignment;

  } catch (err) {
    console.error('[LOGISTICS] Assignment Error:', err);
    return null;
  }
}

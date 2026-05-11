import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  try {
    const { deliveryId, code, agentId } = await req.json();

    if (!deliveryId || !code || !agentId) {
       return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // 1. Fetch Delivery and associated Order
    const { data: delivery, error: fetchError } = await supabaseAdmin
      .from('deliveries')
      .select('*, orders(*)')
      .eq('id', deliveryId)
      .eq('agent_id', agentId)
      .single();

    if (fetchError || !delivery || !delivery.orders) {
      return NextResponse.json({ error: 'Delivery record not found or unauthorized' }, { status: 404 });
    }

    // 2. Verify Delivery Code
    if (delivery.orders.delivery_code !== code) {
       return NextResponse.json({ error: 'Invalid delivery code. Check with the customer.' }, { status: 400 });
    }

    if (delivery.status === 'delivered' || delivery.orders.status === 'delivered') {
       return NextResponse.json({ error: 'Delivery already verified.' }, { status: 400 });
    }

    // 3. Mark as Delivered
    // This will trigger the DB function 'handle_delivery_completion' which:
    // - Releases vendor funds
    // - Pays the agent
    // - Updates the order status to 'delivered'
    const { error: updateError } = await supabaseAdmin
      .from('deliveries')
      .update({ 
        status: 'delivered',
        delivered_at: new Date().toISOString()
      })
      .eq('id', deliveryId);

    if (updateError) throw updateError;

    // 4. Create Final Notification for Customer (Trigger handles Vendor)
    await supabaseAdmin.from('notifications').insert({
      user_id: delivery.orders.customer_id,
      type: 'order_update',
      title: 'Order Delivered! 🎁',
      content: `Your order #${delivery.orders.id.slice(0, 8)} has been successfully verified and delivered. Enjoy!`,
      link: '/dashboard/customer'
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Delivery verified and completed successfully!' 
    });

  } catch (error: any) {
    console.error('Delivery Verification Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

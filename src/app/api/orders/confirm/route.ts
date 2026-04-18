import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  try {
    const { orderId, userId } = await req.json();

    if (!orderId || !userId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // 1. Fetch the order and verify the customer
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('*, brands(owner_id)')
      .eq('id', orderId)
      .eq('customer_id', userId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: 'Order not found or unauthorized' }, { status: 404 });
    }

    if (order.status !== 'delivered') {
      return NextResponse.json({ error: 'Order must be in delivered status to confirm' }, { status: 400 });
    }

    // 2. Update Order Status to 'confirmed'
    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({ 
        status: 'confirmed',
        confirmed_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (updateError) throw updateError;

    // 3. Release Funds to Vendor Wallet
    const { error: walletError } = await supabaseAdmin.rpc('increment_brand_wallet', {
      brand_uuid: order.brand_id,
      amount_to_add: order.vendor_earning
    });

    // Fallback if the RPC doesn't exist yet (Manual update)
    if (walletError) {
      const { data: brand } = await supabaseAdmin.from('brands').select('wallet_balance').eq('id', order.brand_id).single();
      const newBalance = Number(brand?.wallet_balance || 0) + Number(order.vendor_earning);
      await supabaseAdmin.from('brands').update({ wallet_balance: newBalance }).eq('id', order.brand_id);
    }

    // 4. Create Ledger Entry
    await supabaseAdmin.from('transactions').insert({
      order_id: orderId,
      brand_id: order.brand_id,
      user_id: order.customer_id,
      type: 'escrow_release',
      amount: order.vendor_earning,
      status: 'success',
      description: `Escrow released to vendor for order ${orderId.slice(0, 8)}`
    });

    return NextResponse.json({ success: true, message: 'Escrow released successfully' });

  } catch (error: any) {
    console.error('Confirm Order Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

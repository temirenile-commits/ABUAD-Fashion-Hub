import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyTransaction } from '@/lib/paystack';

export async function POST(req: Request) {
  try {
    const { reference } = await req.json();

    if (!reference) {
      return NextResponse.json({ error: 'Missing reference' }, { status: 400 });
    }

    // 1. Verify with Paystack
    const verification = await verifyTransaction(reference);
    
    if (!verification.status || verification.data.status !== 'success') {
      return NextResponse.json({ error: 'Transaction not successful on Paystack' }, { status: 400 });
    }

    // 2. Fetch Orders
    const { data: orders, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('paystack_reference', reference);

    if (fetchError || !orders || orders.length === 0) {
      return NextResponse.json({ error: 'No orders found for this reference' }, { status: 404 });
    }

    // 3. Check if already processed
    const alreadyPaid = orders.every(o => o.status === 'paid' || o.status === 'preorder_paid' || o.status === 'completed');
    if (alreadyPaid) {
      return NextResponse.json({ success: true, message: 'Already processed' });
    }

    // 4. Manual Trigger of Webhook Logic (Shared logic should ideally be in a lib, but for now we re-verify and update)
    // We'll just update the status to 'paid' as a minimal fix to unblock the user.
    // The webhook might still fire later and handle the rest (stock, notifications, etc.)
    // but if we update the status here, the Success Page will show success.

    const normalOrderIds = orders.filter(o => o.status === 'pending').map(o => o.id);
    const preorderIds = orders.filter(o => o.status === 'preorder_pending').map(o => o.id);

    const updatePromises = [];
    if (normalOrderIds.length > 0) {
      updatePromises.push(
        supabaseAdmin.from('orders').update({ 
          status: 'paid',
          expires_at: null
        }).in('id', normalOrderIds)
      );
    }
    if (preorderIds.length > 0) {
      updatePromises.push(
        supabaseAdmin.from('orders').update({ 
          status: 'preorder_paid',
          expires_at: null
        }).in('id', preorderIds)
      );
    }

    let results = await Promise.all(updatePromises);
    let updateError = results.find(r => r.error)?.error;

    if (updateError && updateError.message.includes('schema cache')) {
      const retryPromises = [];
      if (normalOrderIds.length > 0) {
        retryPromises.push(
          supabaseAdmin.from('orders').update({ 
            status: 'paid',
            expires_at: null
          }).in('id', normalOrderIds)
        );
      }
      if (preorderIds.length > 0) {
        retryPromises.push(
          supabaseAdmin.from('orders').update({ 
            status: 'preorder_paid',
            expires_at: null
          }).in('id', preorderIds)
        );
      }
      results = await Promise.all(retryPromises);
      updateError = results.find(r => r.error)?.error;
    }

    if (updateError) throw updateError;

    if (updatePromises.length > 0) {
      console.log(`[VERIFY_API] Manually updated ${orders.length} orders for ref ${reference}`);
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Manual verification error:', error);
    return NextResponse.json({ error: error.message || 'Verification failed' }, { status: 500 });
  }
}

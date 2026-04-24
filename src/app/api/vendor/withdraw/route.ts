import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { initiateTransfer } from '@/lib/paystack';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { brandId, amount } = await req.json();

    if (!brandId || !amount || amount <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid payout request' }, { status: 400 });
    }

    // 1. SECURE VALIDATION: Fetch wallet and recipient code
    const { data: walletData, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('available_balance, brands(recipient_code, owner_id)')
      .eq('brand_id', brandId)
      .single();

    if (walletError || !walletData) {
      return NextResponse.json({ success: false, error: 'Wallet not found' }, { status: 404 });
    }

    const available = Number(walletData.available_balance);
    const brand: any = walletData.brands;
    
    if (!brand.recipient_code) {
      return NextResponse.json({ success: false, error: 'NO_BANK_DETAILS' }, { status: 400 });
    }

    if (available < amount) {
      return NextResponse.json({ success: false, error: 'INSUFFICIENT_FUNDS' }, { status: 400 });
    }

    // 2. ATOMIC LOCK: Deduct from wallet immediately to prevent double spending
    const { error: deductError } = await supabaseAdmin.rpc('adjust_vendor_wallet', {
      p_brand_id: brandId,
      p_available_delta: -amount
    });

    if (deductError) throw deductError;

    // 3. CREATE WITHDRAWAL RECORD
    const reference = `WD-${Date.now()}-${brandId.slice(0, 5)}`;
    const { data: withdrawal, error: withdrawalError } = await supabaseAdmin
      .from('withdrawals')
      .insert({
        brand_id: brandId,
        amount: amount,
        status: 'pending',
        reference: reference
      })
      .select()
      .single();

    if (withdrawalError) {
      // Rollback wallet if record creation fails
      await supabaseAdmin.rpc('adjust_vendor_wallet', {
        p_brand_id: brandId,
        p_available_delta: amount
      });
      throw withdrawalError;
    }

    // 4. INITIATE PAYSTACK TRANSFER
    try {
      const transferResponse = await initiateTransfer(amount, brand.recipient_code, reference);

      if (transferResponse.status) {
        // Transfer initiated successfully (could be success or pending)
        // We'll update the status based on Paystack's immediate response
        const newStatus = transferResponse.data.status === 'success' ? 'success' : 'pending';
        
        await supabaseAdmin
          .from('withdrawals')
          .update({ status: newStatus })
          .eq('id', withdrawal.id);

        // 5. Add to transactions ledger
        await supabaseAdmin.from('transactions').insert({
          brand_id: brandId,
          user_id: brand.owner_id,
          type: 'payout',
          amount: -amount,
          status: newStatus === 'success' ? 'success' : 'pending',
          description: `Withdrawal to bank account (${reference})`
        });

        return NextResponse.json({ success: true, status: newStatus, reference });
      } else {
        throw new Error(transferResponse.message || 'Paystack transfer initiation failed');
      }
    } catch (paystackError: any) {
      console.error('[PAYSTACK_TRANSFER_FAILED]', paystackError);
      
      // 5. ROLLBACK on failure
      await Promise.all([
        supabaseAdmin.rpc('adjust_vendor_wallet', {
          p_brand_id: brandId,
          p_available_delta: amount
        }),
        supabaseAdmin
          .from('withdrawals')
          .update({ status: 'failed' })
          .eq('id', withdrawal.id)
      ]);

      return NextResponse.json({ success: false, error: paystackError.message }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[WITHDRAWAL_ROUTE_ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get('brandId');

  if (!brandId) return NextResponse.json({ error: 'Missing brandId' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('withdrawals')
    .select('*')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, data });
}

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';


export async function POST(req: Request) {
  try {
    const { brandId, ownerId, amount, method, bankDetails } = await req.json();

    if (!brandId || !amount || !ownerId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // 1. Verify ownership and balance
    const { data: brand, error: brandError } = await supabaseAdmin
      .from('brands')
      .select('wallet_balance, owner_id')
      .eq('id', brandId)
      .single();

    if (brandError || !brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    if (brand.owner_id !== ownerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    if (Number(brand.wallet_balance) < Number(amount)) {
      return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 });
    }

    // 2. Create withdrawal request
    const { data: request, error: requestError } = await supabaseAdmin
      .from('withdrawal_requests')
      .insert({
        brand_id: brandId,
        amount: Number(amount),
        method: method || 'bank_transfer',
        bank_details: bankDetails || {},
        status: 'pending'
      })
      .select()
      .single();

    if (requestError) throw requestError;

    // 3. Deduct from wallet immediately (or mark as "locked")
    // For simplicity, we deduct now. If the request is rejected, we refund it.
    const { error: deductError } = await supabaseAdmin
      .from('brands')
      .update({ wallet_balance: Number(brand.wallet_balance) - Number(amount) })
      .eq('id', brandId);

    if (deductError) throw deductError;

    // 4. Create transaction ledger entry
    await supabaseAdmin.from('transactions').insert({
      brand_id: brandId,
      user_id: ownerId,
      type: 'payout',
      amount: Number(amount),
      status: 'pending',
      description: `Withdrawal request: ${request.id.slice(0,8)}`
    });

    return NextResponse.json({ success: true, request });

  } catch (error: any) {
    console.error('Withdrawal Request Error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get('brandId');

  if (!brandId) return NextResponse.json({ error: 'Missing brandId' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('withdrawal_requests')
    .select('*')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data });
}

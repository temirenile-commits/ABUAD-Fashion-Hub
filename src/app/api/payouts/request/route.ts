import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

type PayoutRole = 'vendor' | 'delivery';

async function getAuthenticatedUser(req: Request) {
  const authorization = req.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;

  const token = authorization.slice('Bearer '.length).trim();
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const role = body?.role as PayoutRole;
    const amount = Number(body?.amount);

    if (!['vendor', 'delivery'].includes(role) || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid payout request' }, { status: 400 });
    }

    let bankDetails: Record<string, string | null>;

    if (role === 'vendor') {
      const { data: brand, error: brandError } = await supabaseAdmin
        .from('brands')
        .select('owner_id, bank_name, bank_account_number, bank_account_name, account_name')
        .eq('owner_id', user.id)
        .limit(1)
        .maybeSingle();

      if (brandError) throw brandError;
      if (!brand) return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 });

      bankDetails = {
        bankName: brand.bank_name,
        accountNumber: brand.bank_account_number,
        accountName: brand.bank_account_name || brand.account_name,
      };
    } else {
      const { data: agent, error: agentError } = await supabaseAdmin
        .from('delivery_agents')
        .select('id, bank_name, bank_account_number, account_name, name')
        .eq('id', user.id)
        .maybeSingle();

      if (agentError) throw agentError;
      if (!agent) return NextResponse.json({ error: 'Delivery-agent profile not found' }, { status: 404 });

      bankDetails = {
        bankName: agent.bank_name,
        accountNumber: agent.bank_account_number,
        accountName: agent.account_name || agent.name,
      };
    }

    if (!bankDetails.bankName || !bankDetails.accountNumber || !bankDetails.accountName) {
      return NextResponse.json({ error: 'Bank details are incomplete' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.rpc('request_payout', {
      p_user_id: user.id,
      p_role: role,
      p_amount: amount,
      p_bank_details: bankDetails,
    });

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to submit payout request';
    console.error('[PAYOUT REQUEST]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

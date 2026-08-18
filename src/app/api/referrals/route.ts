import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthenticatedUser } from '@/lib/server-auth';
import { requireSuperAdmin } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

const defaultConfig = {
  global_enabled: true,
  user_to_user_enabled: true,
  user_to_vendor_enabled: true,
  user_to_user_immediate_reward_enabled: false,
  user_to_user_immediate_reward_amount: 0,
  user_to_user_purchase_reward_enabled: true,
  user_to_user_purchase_reward_percentage: 0,
  user_to_vendor_reward_enabled: true,
  user_to_vendor_reward_percentage: 0,
  minimum_withdrawal: 1000,
  maximum_withdrawal: 100000,
  daily_withdrawal_limit: 100000,
  weekly_withdrawal_limit: 300000,
  monthly_withdrawal_limit: 1000000,
  minimum_qualifying_purchase: 0,
  minimum_vendor_sales: 0,
  reward_confirmation_period_days: 0,
  maximum_reward_per_referred_customer: null,
  maximum_vendor_referral_earning: null,
  maximum_lifetime_referral_reward: null,
};

async function getConfig() {
  const { data } = await supabaseAdmin.from('platform_settings').select('value').eq('key', 'referral_config').maybeSingle();
  return { ...defaultConfig, ...(data?.value || {}) };
}

async function getProfileMap(ids: string[]) {
  if (!ids.length) return new Map<string, { id: string; name: string; email: string; role: string; avatar_url?: string }>();
  const { data } = await supabaseAdmin.from('users').select('id, name, email, role, avatar_url').in('id', [...new Set(ids)]).limit(500);
  return new Map((data || []).map(profile => [profile.id, profile]));
}

async function getUserSnapshot(userId: string) {
  const [{ data: summary }, { data: ownerProfile }] = await Promise.all([
    supabaseAdmin.rpc('referral_balance_summary', { p_user_id: userId }),
    supabaseAdmin.from('users').select('name').eq('id', userId).maybeSingle(),
  ]);
  await supabaseAdmin.rpc('refresh_referral_earnings', { p_user_id: userId });
  const [{ data: links }, { data: relationships }, { data: ledger }, { data: events }] = await Promise.all([
    supabaseAdmin.from('referral_links').select('id, referral_type, code, is_active, click_count, registration_count, activated_count, qualified_count, created_at, last_activity_at').eq('owner_user_id', userId).order('created_at', { ascending: false }).limit(10),
    supabaseAdmin.from('referral_relationships').select('id, referrer_user_id, referred_user_id, referred_brand_id, referral_type, parent_referral_id, root_referral_id, depth, status, created_at, activated_at, qualified_at').or(`referrer_user_id.eq.${userId},referred_user_id.eq.${userId}`).order('created_at', { ascending: false }).limit(200),
    supabaseAdmin.from('referral_ledger').select('id, referral_id, referral_type, source_type, source_transaction_id, amount, currency, status, description, created_at, confirmed_at, available_at, withdrawn_at, reversed_at, metadata').eq('beneficiary_user_id', userId).order('created_at', { ascending: false }).limit(200),
    supabaseAdmin.from('referral_events').select('id, referral_id, event_type, source_order_id, metadata, created_at').or(`actor_user_id.eq.${userId}`).order('created_at', { ascending: false }).limit(100),
  ]);
  const ids = (relationships || []).flatMap(row => [row.referrer_user_id, row.referred_user_id]);
  const profiles = await getProfileMap(ids);
  return {
    config: await getConfig(),
    links: links || [],
    relationships: (relationships || []).map(row => ({ ...row, referrer: profiles.get(row.referrer_user_id) || null, referred: profiles.get(row.referred_user_id) || null })),
    ledger: ledger || [],
    events: events || [],
    summary: summary?.[0] || { total_earned: 0, pending_earnings: 0, available_earnings: 0, withdrawn_earnings: 0, reversed_earnings: 0 },
    referrerName: ownerProfile?.name || null,
  };
}

async function requireUser(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) throw NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  return user;
}

function validateConfig(input: Record<string, unknown>) {
  const percentageKeys = ['user_to_user_purchase_reward_percentage', 'user_to_vendor_reward_percentage'];
  for (const key of percentageKeys) {
    if (input[key] !== undefined && (!Number.isFinite(Number(input[key])) || Number(input[key]) < 0 || Number(input[key]) > 100)) {
      throw new Error(`${key} must be between 0 and 100`);
    }
  }
  const numericKeys = [
    'user_to_user_immediate_reward_amount', 'minimum_withdrawal', 'maximum_withdrawal',
    'daily_withdrawal_limit', 'weekly_withdrawal_limit', 'monthly_withdrawal_limit',
    'minimum_qualifying_purchase', 'minimum_vendor_sales', 'reward_confirmation_period_days',
  ];
  for (const key of numericKeys) {
    if (input[key] !== undefined && (!Number.isFinite(Number(input[key])) || Number(input[key]) < 0)) {
      throw new Error(`${key} must be a non-negative number`);
    }
  }
  const min = input.minimum_withdrawal === undefined ? undefined : Number(input.minimum_withdrawal);
  const max = input.maximum_withdrawal === undefined ? undefined : Number(input.maximum_withdrawal);
  if (min !== undefined && max !== undefined && min > max) throw new Error('Minimum withdrawal cannot exceed maximum withdrawal');
}

export async function GET(req: NextRequest) {
  try {
    const action = req.nextUrl.searchParams.get('action') || 'summary';
    if (action === 'admin') {
      await requireSuperAdmin(req);
      const config = await getConfig();
      const [{ count: totalLinks }, { count: clicks }, { count: registered }, { count: active }, { count: qualified }, { data: ledger }, { data: payouts }, { data: linkRows }, { data: relationshipRows }] = await Promise.all([
        supabaseAdmin.from('referral_links').select('id', { count: 'exact', head: true }),
        supabaseAdmin.from('referral_events').select('id', { count: 'exact', head: true }).eq('event_type', 'clicked'),
        supabaseAdmin.from('referral_events').select('id', { count: 'exact', head: true }).eq('event_type', 'registered'),
        supabaseAdmin.from('referral_relationships').select('id', { count: 'exact', head: true }).eq('status', 'activated'),
        supabaseAdmin.from('referral_relationships').select('id', { count: 'exact', head: true }).eq('status', 'qualified'),
        supabaseAdmin.from('referral_ledger').select('amount, status, source_type, referral_type, created_at').limit(5000),
        supabaseAdmin.from('payout_requests').select('id, user_id, amount_requested, status, source_type, transfer_reference, created_at, confirmed_at').eq('source_type', 'referral').order('created_at', { ascending: false }).limit(200),
        supabaseAdmin.from('referral_links').select('id, owner_user_id, referral_type, code, is_active, click_count, registration_count, activated_count, qualified_count, created_at, last_activity_at').order('created_at', { ascending: false }).limit(500),
        supabaseAdmin.from('referral_relationships').select('id, referrer_user_id, referred_user_id, referred_brand_id, referral_type, parent_referral_id, root_referral_id, depth, status, created_at, activated_at, qualified_at').order('created_at', { ascending: false }).limit(500),
      ]);
      const positive = (ledger || []).filter(row => Number(row.amount) > 0);
      const by = (predicate: (row: any) => boolean) => positive.filter(predicate).reduce((sum, row) => sum + Number(row.amount || 0), 0);
      const adminRelationships = relationshipRows || [];
      const adminProfiles = await getProfileMap(adminRelationships.flatMap(row => [row.referrer_user_id, row.referred_user_id]));
      return NextResponse.json({ config, stats: {
        total_links: totalLinks || 0, total_clicks: clicks || 0, registered_referrals: registered || 0,
        active_referrals: active || 0, qualified_referrals: qualified || 0,
        total_earnings: by(row => !['reversed', 'cancelled'].includes(row.status)),
        pending_earnings: by(row => row.status === 'pending'),
        confirmed_earnings: by(row => ['confirmed', 'available'].includes(row.status)),
        withdrawn_earnings: Math.abs((ledger || []).filter(row => row.source_type === 'REFERRAL_WITHDRAWAL' && row.status === 'withdrawn').reduce((sum, row) => sum + Number(row.amount || 0), 0)),
        reversed_earnings: Math.abs((ledger || []).filter(row => row.source_type === 'REFERRAL_REVERSAL').reduce((sum, row) => sum + Number(row.amount || 0), 0)),
      }, payouts: payouts || [], links: linkRows || [], relationships: adminRelationships.map(row => ({ ...row, referrer: adminProfiles.get(row.referrer_user_id) || null, referred: adminProfiles.get(row.referred_user_id) || null })) });
    }
    const user = await requireUser(req);
    return NextResponse.json(await getUserSnapshot(user.id));
  } catch (error: any) {
    if (error instanceof NextResponse) return error;
    console.error('[REFERRALS_GET]', error);
    return NextResponse.json({ error: 'Unable to load referral information right now.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    if (action === 'settings') {
      const admin = await requireSuperAdmin(req);
      validateConfig(body.config || {});
      const previous = await getConfig();
      const next = { ...previous, ...body.config };
      const { error } = await supabaseAdmin.from('platform_settings').upsert({ key: 'referral_config', value: next, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) throw error;
      await supabaseAdmin.from('referral_admin_audit').insert({ admin_id: admin.userId, action: 'updated_referral_settings', previous_value: previous, new_value: next, metadata: { source: 'admin_dashboard' } });
      return NextResponse.json({ success: true, config: next });
    }
    if (action === 'funnel') {
      const eventType = ['registration_started'].includes(String(body.eventType)) ? String(body.eventType) : null;
      const code = String(body.code || '').trim().toUpperCase();
      if (!eventType || !code) return NextResponse.json({ success: false, tracked: false });
      const { data: link } = await supabaseAdmin.from('referral_links').select('id, referral_type, is_active').eq('code', code).eq('is_active', true).maybeSingle();
      if (!link) return NextResponse.json({ success: false, tracked: false });
      const visitorKey = req.cookies.get('mc_referral_visitor')?.value || crypto.randomUUID();
      const eventKey = `${eventType}:${link.id}:${visitorKey}`;
      await supabaseAdmin.from('referral_attributions').insert({ referral_link_id: link.id, visitor_key: visitorKey, event_type: eventType, metadata: { referral_type: link.referral_type } });
      await supabaseAdmin.from('referral_events').insert({ referral_link_id: link.id, event_type: eventType, event_key: eventKey, metadata: { referral_type: link.referral_type } }).then(() => undefined);
      return NextResponse.json({ success: true, tracked: true });
    }
    const user = await requireUser(req);
    if (action === 'claim') {
      const code = String(body.code || req.cookies.get('mc_referral_code')?.value || '').trim();
      if (!code) return NextResponse.json({ success: true, claimed: false });
      const { data: link } = await supabaseAdmin.from('referral_links').select('id, referral_type').eq('code', code.toUpperCase()).eq('is_active', true).maybeSingle();
      const existingQuery = link
        ? supabaseAdmin.from('referral_relationships').select('id').eq('referred_user_id', user.id).eq('referral_type', link.referral_type).maybeSingle()
        : Promise.resolve({ data: null });
      const [{ data: existingRelationship }, { data, error }] = await Promise.all([
        existingQuery,
        supabaseAdmin.rpc('claim_referral_attribution', { p_code: code, p_referred_user_id: user.id, p_referred_brand_id: body.brandId || null }),
      ]);
      const response = NextResponse.json(error
        ? { success: false, error: error.message.includes('invalid') ? 'Referral link is invalid.' : error.message }
        : { success: true, claimed: Boolean(data) && !existingRelationship, alreadyAttributed: Boolean(existingRelationship), relationshipId: data });
      response.cookies.set('mc_referral_code', '', { path: '/', maxAge: 0 });
      return response;
    }
    if (action === 'vendor_activate') {
      const brandId = String(body.brandId || '');
      const { data: brand } = await supabaseAdmin.from('brands').select('id, owner_id').eq('id', brandId).eq('owner_id', user.id).maybeSingle();
      if (!brand) return NextResponse.json({ error: 'Vendor profile not found.' }, { status: 404 });
      const code = String(body.code || req.cookies.get('mc_referral_code')?.value || '').trim();
      if (!code) return NextResponse.json({ success: true, claimed: false });
      const { data, error } = await supabaseAdmin.rpc('claim_referral_attribution', { p_code: code, p_referred_user_id: user.id, p_referred_brand_id: brand.id });
      if (error) return NextResponse.json({ error: 'This vendor referral could not be activated.' }, { status: 400 });
      const response = NextResponse.json({ success: true, relationshipId: data });
      response.cookies.set('mc_referral_code', '', { path: '/', maxAge: 0 });
      return response;
    }
    if (action === 'withdraw') {
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0 || !body.bankDetails) return NextResponse.json({ error: 'Enter a valid withdrawal amount and bank details.' }, { status: 400 });
      const { data, error } = await supabaseAdmin.rpc('request_referral_payout', { p_user_id: user.id, p_amount: amount, p_bank_details: body.bankDetails });
      if (error) return NextResponse.json({ error: error.message.replace(/^.*?:\s*/, '') }, { status: 400 });
      return NextResponse.json({ success: true, requestId: data });
    }
    if (action === 'link') {
      const type = body.referralType === 'user_to_vendor' ? 'user_to_vendor' : 'user_to_user';
      const { data, error } = await supabaseAdmin.rpc('ensure_referral_link', { p_owner_user_id: user.id, p_referral_type: type });
      if (error) return NextResponse.json({ error: 'Referral rewards are temporarily paused.' }, { status: 400 });
      return NextResponse.json({ success: true, link: data });
    }
    if (action === 'payout_process') {
      const admin = await requireSuperAdmin(req);
      const requestId = String(body.requestId || '');
      const approved = body.status === 'completed';
      const rpc = approved ? 'confirm_referral_payout' : 'reject_referral_payout';
      const args = approved ? { p_request_id: requestId, p_admin_id: admin.userId, p_proof_url: body.proofUrl || null, p_reference: body.reference || null } : { p_request_id: requestId, p_admin_id: admin.userId };
      const { data, error } = await supabaseAdmin.rpc(rpc, args);
      if (error || !data) return NextResponse.json({ error: 'The referral payout could not be updated.' }, { status: 400 });
      await supabaseAdmin.from('referral_admin_audit').insert({ admin_id: admin.userId, action: approved ? 'completed_referral_payout' : 'rejected_referral_payout', new_value: { requestId, status: body.status }, metadata: {} });
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'Unsupported referral action.' }, { status: 400 });
  } catch (error: any) {
    if (error instanceof NextResponse) return error;
    console.error('[REFERRALS_POST]', error);
    return NextResponse.json({ error: error.message || 'Referral action could not be completed.' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const normalized = decodeURIComponent(code || '').trim().toUpperCase();
  const { data: link } = await supabaseAdmin
    .from('referral_links')
    .select('id, owner_user_id, referral_type, is_active, click_count')
    .eq('code', normalized)
    .eq('is_active', true)
    .maybeSingle();

  if (!link) {
    const invalid = new URL('/auth/register', request.url);
    invalid.searchParams.set('ref_error', 'invalid');
    return NextResponse.redirect(invalid);
  }

  const { data: owner } = await supabaseAdmin.from('users').select('name').eq('id', link.owner_user_id).maybeSingle();
  const destination = new URL('/auth/register', request.url);
  destination.searchParams.set('ref', normalized);
  destination.searchParams.set('ref_type', link.referral_type);
  if (owner?.name?.trim()) destination.searchParams.set('referrer', owner.name.trim().slice(0, 80));
  const response = NextResponse.redirect(destination);
  response.cookies.set('mc_referral_code', normalized, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  const visitorKey = request.cookies.get('mc_referral_visitor')?.value || crypto.randomUUID();
  response.cookies.set('mc_referral_visitor', visitorKey, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 90,
  });
  await supabaseAdmin.from('referral_attributions').insert([
    { referral_link_id: link.id, visitor_key: visitorKey, event_type: 'clicked', metadata: { referral_type: link.referral_type } },
    { referral_link_id: link.id, visitor_key: visitorKey, event_type: 'visited', metadata: { referral_type: link.referral_type } },
  ]);
  await supabaseAdmin.from('referral_events').insert([
    { referral_link_id: link.id, event_type: 'clicked', event_key: `clicked:${link.id}:${visitorKey}`, metadata: { referral_type: link.referral_type } },
    { referral_link_id: link.id, event_type: 'visited', event_key: `visited:${link.id}:${visitorKey}`, metadata: { referral_type: link.referral_type } },
  ]);
  await supabaseAdmin
    .from('referral_links')
    .update({ click_count: Number(link.click_count || 0) + 1, last_activity_at: new Date().toISOString() })
    .eq('id', link.id);

  return response;
}

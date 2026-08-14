import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthenticatedUser } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

type RangeKey = 'today' | '7d' | '30d' | '3m' | '6m' | '12m' | 'custom';

function getRange(searchParams: URLSearchParams) {
  const key = (searchParams.get('range') || '30d') as RangeKey;
  const now = new Date();
  let start = new Date(now);
  if (key === 'today') {
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  } else if (key === '7d') {
    start.setUTCDate(start.getUTCDate() - 7);
  } else if (key === '30d') {
    start.setUTCDate(start.getUTCDate() - 30);
  } else if (key === '3m') {
    start.setUTCMonth(start.getUTCMonth() - 3);
  } else if (key === '6m') {
    start.setUTCMonth(start.getUTCMonth() - 6);
  } else if (key === '12m') {
    start.setUTCFullYear(start.getUTCFullYear() - 1);
  } else if (key === 'custom') {
    const requestedStart = searchParams.get('start');
    const requestedEnd = searchParams.get('end');
    if (requestedStart) start = new Date(requestedStart);
    if (requestedEnd) return { key, start, end: new Date(requestedEnd) };
  }
  return { key, start, end: now };
}

function validDate(date: Date) {
  return !Number.isNaN(date.getTime());
}

async function getAdminScope(userId: string) {
  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('role, university_id')
    .eq('id', userId)
    .maybeSingle();
  if (!profile || !['admin', 'super_admin', 'sub_admin'].includes(profile.role)) return null;
  return {
    isFullAdmin: profile.role === 'admin' || profile.role === 'super_admin',
    universityId: profile.university_id as string | null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode') || 'vendor';
    const range = getRange(searchParams);
    if (!validDate(range.start) || !validDate(range.end) || range.start >= range.end) {
      return NextResponse.json({ error: 'Invalid analytics date range.' }, { status: 400 });
    }

    if (mode === 'rankings') {
      const requestedUniversity = searchParams.get('universityId');
      const { data, error } = await supabaseAdmin.rpc('get_university_gmv_rankings', {
        p_start: range.start.toISOString(),
        p_end: range.end.toISOString(),
        p_university_id: requestedUniversity || null,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ range: { key: range.key, start: range.start, end: range.end }, rankings: data || [] });
    }

    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    if (mode === 'vendor') {
      const requestedBrandId = searchParams.get('brandId');
      let brandQuery = supabaseAdmin.from('brands').select('id, name').eq('owner_id', user.id);
      if (requestedBrandId) brandQuery = brandQuery.eq('id', requestedBrandId);
      const { data: brand, error: brandError } = await brandQuery.order('created_at', { ascending: true }).maybeSingle();
      if (brandError) return NextResponse.json({ error: brandError.message }, { status: 500 });
      if (!brand) return NextResponse.json({ error: 'Vendor store not found.' }, { status: 403 });
      const previousStart = new Date(range.start.getTime() - (range.end.getTime() - range.start.getTime()));
      const [summaryResult, previousResult, trendResult] = await Promise.all([
        supabaseAdmin.rpc('get_vendor_financial_summary', {
          p_brand_id: brand.id,
          p_start: range.start.toISOString(),
          p_end: range.end.toISOString(),
        }),
        supabaseAdmin.rpc('get_vendor_financial_summary', {
          p_brand_id: brand.id,
          p_start: previousStart.toISOString(),
          p_end: range.start.toISOString(),
        }),
        supabaseAdmin.rpc('get_vendor_sales_trend', {
          p_brand_id: brand.id,
          p_start: range.start.toISOString(),
          p_end: range.end.toISOString(),
        }),
      ]);
      if (summaryResult.error) return NextResponse.json({ error: summaryResult.error.message }, { status: 500 });
      if (trendResult.error) return NextResponse.json({ error: trendResult.error.message }, { status: 500 });
      const summary = summaryResult.data || {};
      const previous = previousResult.data || {};
      const currentSales = Number(summary.vendor_earnings || 0);
      const previousSales = Number(previous.vendor_earnings || 0);
      const growth = previousSales === 0 ? (currentSales > 0 ? 100 : 0) : ((currentSales - previousSales) / previousSales) * 100;
      return NextResponse.json({
        range: { key: range.key, start: range.start, end: range.end },
        brand,
        summary,
        trend: trendResult.data || [],
        growth: Number(growth.toFixed(2)),
      });
    }

    if (mode === 'platform') {
      const scope = await getAdminScope(user.id);
      if (!scope) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
      const requestedUniversity = searchParams.get('universityId');
      const universityId = scope.isFullAdmin ? requestedUniversity || null : scope.universityId;
      const { data: summary, error } = await supabaseAdmin.rpc('get_platform_financial_summary', {
        p_start: range.start.toISOString(),
        p_end: range.end.toISOString(),
        p_university_id: universityId,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ range: { key: range.key, start: range.start, end: range.end }, scope: { universityId, isFullAdmin: scope.isFullAdmin }, summary: summary || {} });
    }

    return NextResponse.json({ error: 'Unsupported analytics mode.' }, { status: 400 });
  } catch (error) {
    console.error('[ANALYTICS] Request failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Analytics request failed.' }, { status: 500 });
  }
}

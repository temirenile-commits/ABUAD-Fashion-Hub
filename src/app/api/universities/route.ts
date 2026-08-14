import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// GET — List all universities or get rankings
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  if (action === 'rankings') {
    const { data: unis, error: uniError } = await supabaseAdmin
      .from('universities')
      .select('id, name, abbreviation, logo_url')
      .eq('is_active', true);
    if (uniError) return NextResponse.json({ error: uniError.message }, { status: 500 });

    const rangeKey = searchParams.get('range') || '30d';
    const end = new Date();
    const start = new Date(end);
    if (rangeKey === 'today') start.setUTCHours(0, 0, 0, 0);
    else if (rangeKey === '7d') start.setUTCDate(start.getUTCDate() - 7);
    else if (rangeKey === '3m') start.setUTCMonth(start.getUTCMonth() - 3);
    else if (rangeKey === '6m') start.setUTCMonth(start.getUTCMonth() - 6);
    else if (rangeKey === '12m') start.setUTCFullYear(start.getUTCFullYear() - 1);
    else start.setUTCDate(start.getUTCDate() - 30);

    const { data: rankedRows, error: rankingError } = await supabaseAdmin.rpc('get_university_gmv_rankings', {
      p_start: start.toISOString(),
      p_end: end.toISOString(),
      p_university_id: null,
    });
    if (rankingError) return NextResponse.json({ error: rankingError.message }, { status: 500 });

    const rankingMap = new Map((rankedRows || []).map((row: any) => [row.university_id, row]));
    const rankings = unis
      .map((university, index) => {
        const row = rankingMap.get(university.id) as any;
        return {
          ...university,
          rank: row?.rank || index + 1,
          gmv: Number(row?.gmv || 0),
          monthly_revenue: Number(row?.gmv || 0),
          order_count: Number(row?.order_count || 0),
          sales_volume: Number(row?.sales_volume || 0),
          vendor_activity: Number(row?.vendor_activity || 0),
          growth: Number(row?.growth || 0),
        };
      })
      .sort((a, b) => b.gmv - a.gmv || a.name.localeCompare(b.name))
      .map((row, index) => ({ ...row, rank: index + 1 }));

    return NextResponse.json({ rankings, range: { key: rangeKey, start: start.toISOString(), end: end.toISOString() } });
  }

  const { data, error } = await supabaseAdmin
    .from('universities')
    .select('*')
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ universities: data || [] });
}

// POST — Create or update a university (super admin only)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  if (action === 'create') {
    const { name, location, abbreviation, logoUrl } = body;
    if (!name) return NextResponse.json({ error: 'University name is required.' }, { status: 400 });

    const { data, error } = await supabaseAdmin.from('universities').insert({
      name,
      location: location || null,
      abbreviation: abbreviation || null,
      logo_url: logoUrl || null,
      is_active: true,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, university: data });
  }

  if (action === 'update') {
    const { id, name, location, abbreviation, isActive } = body;
    if (!id) return NextResponse.json({ error: 'University ID required.' }, { status: 400 });

    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (location !== undefined) updateData.location = location;
    if (abbreviation !== undefined) updateData.abbreviation = abbreviation;
    if (isActive !== undefined) updateData.is_active = isActive;

    const { error } = await supabaseAdmin.from('universities').update(updateData).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'assign_admin') {
    // Assign a user as university_admin for a specific university
    const { userId, universityId } = body;
    if (!userId || !universityId) {
      return NextResponse.json({ error: 'userId and universityId required.' }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from('users').update({
      role: 'university_admin',
      university_id: universityId,
    }).eq('id', userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Notify the user
    await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      title: 'You have been assigned as University Admin',
      content: 'You now have access to the University Admin dashboard. Visit /university-admin to get started.',
      type: 'system',
      is_read: false,
    });

    return NextResponse.json({ success: true });
  }

  if (action === 'revoke_admin') {
    const { userId } = body;
    const { error } = await supabaseAdmin.from('users').update({
      role: 'customer',
      admin_permissions: [],
    }).eq('id', userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

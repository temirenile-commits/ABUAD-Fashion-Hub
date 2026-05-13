import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// GET — List all universities or get rankings
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  if (action === 'rankings') {
    // 1. Fetch all active universities
    const { data: unis, error: uniError } = await supabaseAdmin
      .from('universities')
      .select('id, name, abbreviation, logo_url')
      .eq('is_active', true);
    
    if (uniError) return NextResponse.json({ error: uniError.message }, { status: 500 });

    // 2. Get the start of the current month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // 3. Fetch all delivered orders for this month
    const { data: orders, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('total_amount, brands(university_id)')
      .gte('created_at', startOfMonth.toISOString())
      .in('status', ['delivered', 'confirmed', 'completed']);

    if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });

    // 4. Aggregate revenue per university
    const revenueMap: Record<string, number> = {};
    orders?.forEach((o: any) => {
      const uniId = o.brands?.university_id;
      if (uniId) {
        revenueMap[uniId] = (revenueMap[uniId] || 0) + Number(o.total_amount);
      }
    });

    // 5. Combine with university data and sort
    const rankings = unis.map(u => ({
      ...u,
      monthly_revenue: revenueMap[u.id] || 0
    })).sort((a, b) => b.monthly_revenue - a.monthly_revenue);

    return NextResponse.json({ rankings });
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

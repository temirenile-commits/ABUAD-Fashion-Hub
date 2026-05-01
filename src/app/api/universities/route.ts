import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// GET — List all universities
export async function GET(req: NextRequest) {
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

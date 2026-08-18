import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

async function requireUser(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) throw NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  return user;
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const { data: profile, error } = await supabaseAdmin
      .from('users')
      .select('id, role, university_id, universities:universities!users_university_id_fkey(id, name, abbreviation, logo_url)')
      .eq('id', user.id)
      .single();
    if (error || !profile) return NextResponse.json({ error: error?.message || 'Profile not found.' }, { status: 404 });
    const { data: universities, error: universitiesError } = await supabaseAdmin
      .from('universities')
      .select('id, name, abbreviation, logo_url, location')
      .eq('is_active', true)
      .order('name', { ascending: true });
    if (universitiesError) return NextResponse.json({ error: universitiesError.message }, { status: 500 });
    return NextResponse.json({ profile, universities: universities || [] });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load university context.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const body = await req.json();
    const action = String(body?.action || '');

    if (action === 'switch_customer') {
      const { data: existing } = await supabaseAdmin.from('users').select('role').eq('id', user.id).single();
      if (!existing || !['customer', 'user'].includes(existing.role)) {
        return NextResponse.json({ error: 'Only customer accounts can switch marketplace university.' }, { status: 403 });
      }
      const { data, error } = await supabaseAdmin.rpc('switch_marketplace_university', {
        p_user_id: user.id,
        p_university_id: body.universityId,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, profile: data });
    }

    return NextResponse.json({ error: 'Unknown university context action.' }, { status: 400 });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'University context request failed.' }, { status: 500 });
  }
}

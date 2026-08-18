import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

async function currentUser(req: NextRequest) {
  const user = await getAuthenticatedUser(req);
  if (!user) throw NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  return user;
}

export async function GET(req: NextRequest) {
  try {
    const user = await currentUser(req);
    const { data: brand, error: brandError } = await supabaseAdmin
      .from('brands')
      .select('id, owner_id, university_id, verified, verification_status, universities:universities!brands_university_id_fkey(id, name, abbreviation)')
      .eq('owner_id', user.id)
      .maybeSingle();
    if (brandError) return NextResponse.json({ error: brandError.message }, { status: 500 });
    if (!brand) return NextResponse.json({ error: 'Vendor store not found.' }, { status: 404 });

    const [{ data: universities, error: universityError }, { data: requests, error: requestsError }] = await Promise.all([
      supabaseAdmin.from('universities').select('id, name, abbreviation, location').eq('is_active', true).order('name'),
      supabaseAdmin.from('vendor_university_change_requests').select('*, current_university:universities!vendor_university_change_requests_current_university_id_fkey(id,name,abbreviation), requested_university:universities!vendor_university_change_requests_requested_university_id_fkey(id,name,abbreviation)').eq('vendor_id', brand.id).order('created_at', { ascending: false }).limit(20),
    ]);
    if (universityError) return NextResponse.json({ error: universityError.message }, { status: 500 });
    if (requestsError) return NextResponse.json({ error: requestsError.message }, { status: 500 });
    return NextResponse.json({ brand, universities: universities || [], requests: requests || [] });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load vendor university settings.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser(req);
    const body = await req.json();
    const action = String(body?.action || '');

    if (action === 'submit') {
      const { data: brand } = await supabaseAdmin.from('brands').select('id').eq('owner_id', user.id).maybeSingle();
      if (!brand) return NextResponse.json({ error: 'Vendor store not found.' }, { status: 404 });
      const { data, error } = await supabaseAdmin.rpc('submit_vendor_university_change_request', {
        p_vendor_id: brand.id,
        p_requesting_user_id: user.id,
        p_requested_university_id: body.requestedUniversityId,
        p_reason: body.reason,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, request: data });
    }

    if (action === 'cancel') {
      const { data, error } = await supabaseAdmin.rpc('cancel_vendor_university_change_request', { p_request_id: body.requestId, p_user_id: user.id });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true, request: data });
    }

    return NextResponse.json({ error: 'Unknown vendor university action.' }, { status: 400 });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Vendor university request failed.' }, { status: 500 });
  }
}

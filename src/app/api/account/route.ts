import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createServerClient } from '@supabase/ssr';

/**
 * Account management API (server-side only).
 *
 * DELETE  /api/account           — Full account deletion:
 *   Requires the requesting user's session (cookie-based auth).
 *   Uses the service-role admin client to permanently remove the user from
 *   Supabase Auth (auth.users) and purge their public.users profile row
 *   together with related user-owned data where safe.
 *   Client then signs out and redirects home.
 */
export async function DELETE(request: NextRequest) {
  try {
    // Resolve the caller's session from cookies (server client, RLS-aware)
    const browser = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll() {},
        },
      },
    );

    const {
      data: { user },
    } = await browser.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Not authenticated.' }, { status: 401 });
    }

    const userId = user.id;

    // Purge user-owned data that would otherwise violate FK constraints or
    // leave orphaned records. Soft-reference tables (orders, messages, etc.)
    // are anonymized rather than deleted to preserve business records.
    const admin = supabaseAdmin;

    // Anonymize orders & messages referencing this user so business records
    // survive while the user's identity is fully removed
    await admin.from('orders').update({ customer_id: null as any }).eq('customer_id', userId);
    await admin.from('messages').delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

    // Delete public profile row
    await admin.from('users').delete().eq('id', userId);

    // Permanently delete from Supabase Auth (bypasses RLS)
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      console.error('[account/delete] auth admin deleteUser failed:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete account. Please contact support.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[account/delete]', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error.' },
      { status: 500 },
    );
  }
}

import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSafeCallbackDestination } from '@/lib/auth-redirect';

/**
 * Completes Google/OAuth PKCE, persists the session cookies on the redirect
 * response, ensures a public MasterCart profile exists, and returns the user
 * to the canonical application instead of an OAuth/preview host.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const errorDescription = requestUrl.searchParams.get('error_description');
  const destination = getSafeCallbackDestination(requestUrl);
  const response = NextResponse.redirect(destination);

  if (errorDescription) {
    return NextResponse.redirect(new URL(`/auth/login?error=oauth_failed&message=${encodeURIComponent(errorDescription.slice(0, 160))}`, requestUrl.origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/auth/login?error=oauth_missing_code', requestUrl.origin));
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError || !sessionData.user) {
    console.error('OAuth callback exchange failed:', exchangeError?.message || 'No authenticated user returned');
    return NextResponse.redirect(new URL('/auth/login?error=oauth_failed', requestUrl.origin));
  }

  const authUser = sessionData.user;
  const metadata = authUser.user_metadata || {};
  const profile = {
    id: authUser.id,
    email: authUser.email || null,
    name: metadata.name || metadata.full_name || authUser.email?.split('@')[0] || 'MasterCart User',
    avatar_url: metadata.avatar_url || metadata.picture || null,
    role: 'customer',
    status: 'active',
  };

  const { data: existingProfile, error: profileReadError } = await supabaseAdmin
    .from('users')
    .select('id, role')
    .eq('id', authUser.id)
    .maybeSingle();

  if (profileReadError) console.error('OAuth profile lookup failed:', profileReadError.message);

  const { error: profileWriteError } = existingProfile
    ? await supabaseAdmin.from('users').update({ email: profile.email, name: profile.name, avatar_url: profile.avatar_url }).eq('id', authUser.id)
    : await supabaseAdmin.from('users').insert(profile);

  if (profileWriteError) {
    console.error('OAuth profile provisioning failed:', profileWriteError.message);
    return NextResponse.redirect(new URL('/auth/login?error=account_provisioning_failed', requestUrl.origin));
  }

  return response;
}

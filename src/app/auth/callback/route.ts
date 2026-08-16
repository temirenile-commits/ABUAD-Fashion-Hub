import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSafeCallbackDestination } from '@/lib/auth-redirect';

const PUBLIC_RETURN_PATHS = new Set([
  '/',
  '/explore',
  '/vendors',
  '/reels',
  '/delicacies',
  '/cart',
  '/checkout',
  '/onboarding',
  '/settings',
]);

function destinationForRole(role: string | null | undefined): string {
  switch (role) {
    case 'super_admin':
    case 'admin':
    case 'sub_admin':
    case 'customer_support_agent':
      return '/admin';
    case 'university_admin':
    case 'university_staff':
      return '/university-admin';
    case 'vendor':
      return '/dashboard/vendor';
    case 'rider':
    case 'delivery':
      return '/dashboard/delivery';
    default:
      return '/dashboard/customer';
  }
}

function chooseDestination(requested: URL, role: string | null | undefined, origin: string): URL {
  const roleDestination = destinationForRole(role);
  const requestedPath = requested.pathname || '/';
  const isRoleDestination = requestedPath === roleDestination;
  const isSafePublicDestination = PUBLIC_RETURN_PATHS.has(requestedPath);
  return new URL(isRoleDestination || isSafePublicDestination ? `${requestedPath}${requested.search}` : roleDestination, origin);
}

/**
 * Completes Google/OAuth PKCE, persists the session cookies on the redirect
 * response, provisions a public MasterCart profile when necessary, resolves
 * the existing MasterCart role, and redirects to the authorized destination.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const errorDescription = requestUrl.searchParams.get('error_description');

  if (errorDescription) {
    return NextResponse.redirect(new URL(`/auth/login?error=oauth_failed&message=${encodeURIComponent(errorDescription.slice(0, 160))}`, requestUrl.origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/auth/login?error=oauth_missing_code', requestUrl.origin));
  }

  // Create the redirect response first. Supabase SSR writes exchanged session
  // cookies onto this exact response; returning a different response would
  // silently discard the cookies and recreate the OAuth-state regression.
  const requestedDestination = getSafeCallbackDestination(requestUrl);
  const response = NextResponse.redirect(new URL('/', requestUrl.origin));
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
      auth: {
        flowType: 'pkce',
        autoRefreshToken: false,
        persistSession: true,
        detectSessionInUrl: false,
      },
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
    ? await supabaseAdmin
        .from('users')
        .update({ email: profile.email, name: profile.name, avatar_url: profile.avatar_url })
        .eq('id', authUser.id)
    : await supabaseAdmin.from('users').insert(profile);

  if (profileWriteError) {
    console.error('OAuth profile provisioning failed:', profileWriteError.message);
    return NextResponse.redirect(new URL('/auth/login?error=account_provisioning_failed', requestUrl.origin));
  }

  const finalDestination = chooseDestination(requestedDestination, existingProfile?.role || profile.role, requestUrl.origin);
  response.headers.set('location', finalDestination.toString());
  return response;
}

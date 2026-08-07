import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Google OAuth (and other OAuth provider) callback handler.
 * Supabase redirects the browser here with a `code` query parameter after the
 * user authorizes on the provider. We exchange the code for a session, set the
 * session cookies, and send the user back to the home page (or the dashboard).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  // If providers are set to PKCE the code may come through `code`; flow token
  // can also appear as `access_token`. Supabase Auth always uses `code` with
  // flow_type=pkce for the JS client, which is what signInWithOAuth uses.

  const response = NextResponse.next({
    request: { headers: request.headers },
  });

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
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error('OAuth callback error:', error);
      // Fall back to the sign-in page so the user can try again
      return NextResponse.redirect(new URL('/auth/login?error=oauth_failed', request.url));
    }
  }

  return NextResponse.redirect(new URL('/', request.url));
}

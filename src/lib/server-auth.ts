import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase-admin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

async function getUserFromAuthorizationHeader(req: Request) {
  const authorization = req.headers.get('authorization') || '';
  if (!authorization) return null;

  const token = authorization.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : '';
  if (!token) return null;

  // Supabase access tokens are JWTs. Avoid sending malformed header values to
  // the Auth API, while allowing the SSR client to handle cookie sessions.
  if (token.split('.').length !== 3) {
    console.warn('[AUTH] Ignoring malformed bearer token');
    return null;
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    console.error('[AUTH] Authorization token verification failed:', {
      code: error?.code,
      message: error?.message,
    });
    return null;
  }

  return data.user;
}

/**
 * Resolve the authenticated user from either an explicit bearer token or the
 * canonical Supabase SSR cookie session. Cookie reconstruction is delegated to
 * @supabase/ssr so chunked auth-token cookies are reassembled correctly.
 */
export async function getAuthenticatedSupabaseClient(req: Request) {
  const authorization = req.headers.get('authorization') || '';
  if (authorization && supabaseUrl && supabaseAnonKey) {
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authorization } },
    });
  }

  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    auth: { flowType: 'pkce', autoRefreshToken: false, persistSession: true, detectSessionInUrl: false },
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* read-only cookie context */ }
      },
    },
  });
}

export async function getAuthenticatedUser(req: Request) {
  const authorization = req.headers.get('authorization') || '';
  if (authorization) return getUserFromAuthorizationHeader(req);

  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: 'pkce',
        autoRefreshToken: false,
        persistSession: true,
        detectSessionInUrl: false,
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // A read-only cookie context can occur outside a route handler. The
            // current request can still be authenticated from its cookies.
          }
        },
      },
    });

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      if (error) {
        console.error('[AUTH] SSR session verification failed:', {
          code: error.code,
          message: error.message,
        });
      }
      return null;
    }

    return data.user;
  } catch (error) {
    console.error('[AUTH] SSR session resolution failed:', error instanceof Error ? error.message : 'unknown error');
    return null;
  }
}

import { supabaseAdmin } from '@/lib/supabase-admin';
import { cookies } from 'next/headers';

export async function getAuthenticatedUser(req: Request) {
  // 1. Check Authorization header
  const authorization = req.headers.get('authorization') || '';
  let token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';

  if (!token) {
    // 2. Fallback to Supabase cookies
    try {
      const cookieStore = await cookies();
      const allCookies = cookieStore.getAll();
      for (const cookie of allCookies) {
        if (cookie.name.includes('-auth-token') || cookie.name === 'sb-access-token') {
          try {
            const parsed = JSON.parse(cookie.value);
            if (parsed?.access_token) {
              token = parsed.access_token;
              break;
            } else if (typeof cookie.value === 'string' && cookie.value.length > 20) {
              token = cookie.value;
              break;
            }
          } catch {
            if (typeof cookie.value === 'string' && cookie.value.length > 20) {
              token = cookie.value;
              break;
            }
          }
        }
      }
    } catch (e) {
      // Cookies might not be available in some contexts
    }
  }

  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    const authError = error as any;
    console.error('[AUTH] Token verification failed:', {
      code: authError?.code,
      message: authError?.message,
    });
    return null;
  }

  return data.user;
}

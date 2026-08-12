import { supabaseAdmin } from '@/lib/supabase-admin';

export async function getAuthenticatedUser(req: Request) {
  const authorization = req.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';

  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    const authError = error as any;
    console.error('[AUTH] Token verification failed:', {
      code: authError?.code,
      message: authError?.message,
      details: authError?.details,
      hint: authError?.hint,
    });
    return null;
  }

  return data.user;
}

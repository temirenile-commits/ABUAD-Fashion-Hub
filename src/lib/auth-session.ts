import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

const SESSION_RETRY_DELAYS_MS = [0, 150, 400, 800];

/**
 * Resolve the browser session after navigation, allowing @supabase/ssr time
 * to hydrate its cookie-backed auth state before protected pages redirect.
 * A single null getSession() result is not sufficient evidence that OAuth
 * failed immediately after the callback.
 */
export async function getStableSession(): Promise<Session | null> {
  for (const delayMs of SESSION_RETRY_DELAYS_MS) {
    if (delayMs > 0) await new Promise((resolve) => window.setTimeout(resolve, delayMs));

    const { data, error } = await supabase.auth.getSession();
    if (error) console.warn('[AUTH] Session hydration check failed:', error.message);
    if (data.session) return data.session;
  }

  return null;
}

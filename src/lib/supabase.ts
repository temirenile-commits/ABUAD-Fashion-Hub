import { createBrowserClient } from '@supabase/ssr';
import { createClient as createServerDataClient } from '@supabase/supabase-js';

const configuredSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const configuredSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseUrl = configuredSupabaseUrl || 'https://placeholder.supabase.co';
const supabaseAnonKey = configuredSupabaseAnonKey || 'placeholder-anon-key';

if (!configuredSupabaseUrl || !configuredSupabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Ensure they are set in .env.local');
}

/**
 * The browser bundle uses @supabase/ssr so the PKCE verifier and auth state
 * are persisted in the Supabase SSR cookie format consumed by /auth/callback.
 * Server-rendered modules keep the existing stateless data client because
 * they do not have access to a browser cookie jar.
 */
export const supabase = typeof window !== 'undefined'
  ? createBrowserClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: 'pkce',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : createServerDataClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: 'pkce',
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

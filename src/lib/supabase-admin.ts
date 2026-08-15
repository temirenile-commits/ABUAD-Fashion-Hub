import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || 'missing-service-role-key';
const hasRuntimeConfiguration = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

if (!hasRuntimeConfiguration) {
  console.error('[SUPABASE] Runtime configuration is missing. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the deployment environment.');
}

/**
 * Admin client bypasses Row Level Security (RLS).
 * MUST ONLY BE USED ON THE SERVER (e.g. API Routes, Webhooks).
 * NEVER expose this client to the browser.
 *
 * The non-empty placeholders allow Next.js to collect route metadata during a
 * build when an environment is not injected into the compiler. Runtime API
 * handlers still fail closed against the placeholder endpoint and retain the
 * configuration diagnostic above.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceRole) {
  console.warn('Supabase URL or Service Role Key is missing. Ensure they are set in .env.local');
}

/**
 * Admin client bypasses Row Level Security (RLS).
 * MUST ONLY BE USED ON THE SERVER (e.g. API Routes, Webhooks).
 * NEVER expose this client to the browser.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

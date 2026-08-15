import { createClient } from '@supabase/supabase-js';

const configuredSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const configuredSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseUrl = configuredSupabaseUrl || 'https://placeholder.supabase.co';
const supabaseAnonKey = configuredSupabaseAnonKey || 'placeholder-anon-key';

if (!configuredSupabaseUrl || !configuredSupabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Ensure they are set in .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

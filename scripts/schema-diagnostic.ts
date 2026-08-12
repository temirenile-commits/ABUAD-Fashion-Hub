import dotenv from 'dotenv';
dotenv.config({ path: '/home/ubuntu/.env' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('--- MASTER CART SCHEMA DIAGNOSTIC ---');

  const tables = ['products', 'brands', 'users', 'cafeterias', 'delicacy_vendor_rankings', 'category_suggestions'];
  
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (error) {
      console.log(`Table [${t}]: Error or missing ->`, error.message);
    } else {
      console.log(`Table [${t}]: Exists. Sample record keys:`, data && data[0] ? Object.keys(data[0]) : 'Empty table');
    }
  }

  console.log('--- SCHEMA DIAGNOSTIC COMPLETE ---');
}

run();

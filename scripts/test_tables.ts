import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceRole);

async function checkTables() {
  console.log('Testing Supabase Connection & Table Existence...');
  const { data, error } = await supabase.from('brands').select('*').limit(1);
  
  if (error) {
    console.error('ERROR REACHING BRANDS TABLE:', error.message, error.code);
  } else {
    console.log('BRANDS TABLE EXISTS! It has this many rows currently:', data.length);
  }

  const { error: usersError } = await supabase.from('users').select('*').limit(1);
  if (usersError) {
    console.error('ERROR REACHING USERS TABLE:', usersError.message, usersError.code);
  } else {
    console.log('USERS TABLE EXISTS!');
  }
}

checkTables();

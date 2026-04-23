const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBrandsSchema() {
  const { data, error } = await supabase.from('brands').select('college').limit(1);
  if (error) {
    console.error('Schema check error:', error.message);
  } else {
    console.log('Schema is OK! Data fetched:', data);
  }
}

checkBrandsSchema();

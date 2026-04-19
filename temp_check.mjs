const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  const { data: brands } = await supabase.from('brands').select('id, name, created_at, owner_id');
  console.log('--- BRANDS ---');
  console.log(brands);

  const { data: products } = await supabase.from('products').select('id, title, brand_id, created_at');
  console.log('\n--- PRODUCTS ---');
  console.log(products);
}

checkData().catch(console.error);

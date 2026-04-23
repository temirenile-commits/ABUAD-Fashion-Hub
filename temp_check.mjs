import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  const { data: brands, error: bError } = await supabase
    .from('brands')
    .select('id, name, wallet_balance, verified, created_at, owner_id');
  
  if (bError) console.error('Error fetching brands:', bError);
  console.log('--- BRANDS ---');
  console.table(brands);

  const { data: products, error: pError } = await supabase
    .from('products')
    .select('id, title, brand_id, created_at');
    
  if (pError) console.error('Error fetching products:', pError);
  console.log('\n--- PRODUCTS ---');
  console.table(products);

  const { data: orders, error: oError } = await supabase
    .from('orders')
    .select('id, total_amount, status, created_at');

  if (oError) console.error('Error fetching orders:', oError);
  console.log('\n--- ORDERS (Recent) ---');
  console.table(orders?.slice(0, 5));
}

checkData().catch(console.error);

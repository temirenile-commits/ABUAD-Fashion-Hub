const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
  global: { fetch: (...args) => fetch(...args).catch(err => { console.error('Fetch error:', err); throw err; }) }
});

async function diagnose() {
  try {
    console.log('Fetching Users...');
    const { data: users, error: uErr } = await supabase.from('users').select('*');
    if (uErr) console.error('Users error:', uErr);
    else console.log(`Found ${users.length} users.`);

    console.log('Fetching Brands...');
    const { data: brands, error: bErr } = await supabase.from('brands').select('*');
    if (bErr) console.error('Brands error:', bErr);
    else console.log(`Found ${brands.length} brands.`);

    if (users && users.length > 0) {
        console.table(users.map(u => ({ id: u.id, email: u.email, role: u.role })));
    }
    if (brands && brands.length > 0) {
        console.table(brands.map(b => ({ id: b.id, name: b.name, status: b.verification_status })));
    }

  } catch (e) {
    console.error('Fatal diagnostic error:', e);
  }
}

diagnose();

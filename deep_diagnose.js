const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function deepDiagnose() {
  console.log('--- AUTH USERS ---');
  const { data: { users: authUsers }, error: authErr } = await supabase.auth.admin.listUsers();
  if (authErr) console.error('Auth check error:', authErr.message);
  else {
    console.table(authUsers.map(u => ({ id: u.id, email: u.email, metadata: JSON.stringify(u.user_metadata) })));
  }

  console.log('\n--- PUBLIC USERS ---');
  const { data: publicUsers, error: pubErr } = await supabase.from('users').select('*');
  if (pubErr) console.error('Public users check error:', pubErr.message);
  else {
    console.table(publicUsers.map(u => ({ id: u.id, email: u.email, role: u.role, name: u.name })));
  }

  console.log('\n--- BRANDS ---');
  const { data: brands, error: brandErr } = await supabase.from('brands').select('*');
  if (brandErr) console.error('Brands check error:', brandErr.message);
  else {
    console.table(brands.map(b => ({ id: b.id, name: b.name, owner: b.owner_id, status: b.verification_status })));
  }

  // Find users in Auth but missing in Public
  const missingProfiles = authUsers.filter(au => !publicUsers.find(pu => pu.id === au.id));
  if (missingProfiles.length > 0) {
    console.log(`\n⚠️ ALERT: Found ${missingProfiles.length} users with NO profile in public.users!`);
    for (const u of missingProfiles) {
      console.log(`- Missing Profile for: ${u.email} (${u.id})`);
    }
  } else {
    console.log('\n✅ All Auth users have public profiles.');
  }
}

deepDiagnose();

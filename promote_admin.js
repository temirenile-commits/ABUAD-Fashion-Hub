const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function promote() {
  console.log('Promoting all current users to ADMIN for setup...');
  const { data, error } = await supabase
    .from('users')
    .update({ role: 'admin' })
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all

  if (error) console.error('Promotion error:', error);
  else console.log('✅ All users are now Admins. You can now access the full Admin Dashboard.');
}

promote();

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRole) {
  console.error('Missing Supabase environment variables.');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole);

const ADMIN_EMAIL = 'lonewolfdevman@gmail.com';
const ADMIN_PASSWORD = '7045592604';

async function finalLivePurgeAndAdminSetup() {
  console.log('🚮 Starting FULL Production Purge and Admin Setup...');

  try {
    // 1. Wipe all functional tables
    const tablesToWipe = [
      'transactions',
      'notifications',
      'messages',
      'brand_reels',
      'deliveries',
      'orders',
      'products',
      'services',
      'brands'
    ];

    for (const table of tablesToWipe) {
      console.log(`  Cleaning ${table}...`);
      await supabaseAdmin.from(table).delete().neq('id', 'safety_id_placeholder');
    }

    // 2. Wipe all users from Public.Users
    console.log('  Cleaning public.users table...');
    await supabaseAdmin.from('users').delete().neq('id', 'safety_id_placeholder');

    // 3. Wipe all users from Supabase Auth
    console.log('  Cleaning Supabase Auth accounts...');
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    for (const user of users) {
      await supabaseAdmin.auth.admin.deleteUser(user.id);
      console.log(`    Deleted auth account: ${user.email}`);
    }

    // 4. Create the New Admin Account
    console.log(`🚀 Creating New Admin Account: ${ADMIN_EMAIL}`);
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: {
        name: 'Super Admin',
        role: 'admin'
      }
    });

    if (createError) throw createError;

    // 5. Ensure profile exists (If trigger fails or is absent)
    const { error: profileError } = await supabaseAdmin.from('users').upsert({
      id: newUser.user.id,
      name: 'Super Admin',
      email: ADMIN_EMAIL,
      role: 'admin',
      phone: '7045592604'
    });

    if (profileError) {
      console.warn('⚠️ Warning: Could not explicitly create user profile row. Trigger might be missing.', profileError.message);
    }

    console.log('✨ MISSION ACCOMPLISHED: Platform is clean and Admin is initialized.');

  } catch (err) {
    console.error('❌ CRITICAL FAILURE:', err);
  }
}

finalLivePurgeAndAdminSetup();

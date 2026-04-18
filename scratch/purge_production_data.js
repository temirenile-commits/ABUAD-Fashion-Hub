const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRole) {
  console.error('Missing Supabase environment variables.');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole);

const ADMIN_EMAIL = 'lonewolfdevman@gmail.com';

async function purgeProductionData() {
  console.log('🚀 Starting ABUAD Fashion Hub Production Purge...');

  try {
    // 1. Identify Admin User
    const { data: adminUser, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    if (authError) throw authError;

    const mainAdmin = adminUser.users.find(u => u.email === ADMIN_EMAIL);
    if (!mainAdmin) {
      console.error(`❌ Admin email ${ADMIN_EMAIL} not found. Purge aborted for safety.`);
      return;
    }

    const adminId = mainAdmin.id;
    console.log(`✅ Identified Admin: ${ADMIN_EMAIL} (${adminId})`);

    // 2. Destructive Cleanup (Dependent tables first)
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
      const { error } = await supabaseAdmin.from(table).delete().neq('id', 'placeholder_safety_id'); // Delete everything
      if (error) console.warn(`⚠️ Warning clearing ${table}:`, error.message);
      else console.log(`🗑️ Table cleared: ${table}`);
    }

    // 3. User Cleanup (All except Admin)
    console.log('👥 Cleaning up users...');
    const usersToDelete = adminUser.users.filter(u => u.id !== adminId);
    
    for (const user of usersToDelete) {
      await supabaseAdmin.auth.admin.deleteUser(user.id);
      await supabaseAdmin.from('users').delete().eq('id', user.id);
      console.log(`  - Deleted user: ${user.email}`);
    }

    // 4. Reset Admin Progress (Clear admin's brands/orders if any)
    const { error: adminBrandsError } = await supabaseAdmin.from('brands').delete().eq('owner_id', adminId);
    if (adminBrandsError) console.warn('⚠️ Warning: Could not clear admin brands');

    console.log('✨ MISSION ACCOMPLISHED: Database is now pristine.');

  } catch (err) {
    console.error('❌ CRITICAL FAILURE DURING PURGE:', err);
  }
}

purgeProductionData();

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  const { data, error } = await supabase.from('brands').insert({
    owner_id: '12345678-1234-1234-1234-123456789012', // fake uuid, might fail foreign key
    name: 'Test Brand',
    description: 'test',
    whatsapp_number: '123',
    room_number: '1',
    matric_number: '1',
    college: '1',
    department: '1',
    max_products: 0,
    max_reels: 0,
    trial_started_at: new Date().toISOString()
  });

  if (error) {
    console.error('Insert error:', error);
  } else {
    console.log('Insert ok:', data);
  }
}

testInsert();

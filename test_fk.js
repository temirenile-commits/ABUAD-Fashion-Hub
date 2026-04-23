const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFK() {
  // Try fetching brands and the joined 'users' table
  const { data, error } = await supabase.from('brands').select('*, users!owner_id(id, name, email)');
  if (error) {
    console.error('Fetch error:', error.message);
  } else {
    console.log(`Fetched ${data.length} brands.`);
    if (data.length > 0) {
      console.log('Sample brand:', data[data.length-1]);
    }
  }
}
checkFK();

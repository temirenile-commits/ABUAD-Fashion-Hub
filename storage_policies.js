const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function setStoragePolicies() {
  const sql = `
  -- Allow authenticated users to insert to buckets
  CREATE POLICY "Allow auth inserts to brand-assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'brand-assets');
  CREATE POLICY "Allow auth inserts to verification-docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'verification-docs');
  CREATE POLICY "Allow auth inserts to product-media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-media');

  -- Allow public viewing
  CREATE POLICY "Allow public read brand-assets" ON storage.objects FOR SELECT USING (bucket_id = 'brand-assets');
  CREATE POLICY "Allow public read verification-docs" ON storage.objects FOR SELECT USING (bucket_id = 'verification-docs');
  CREATE POLICY "Allow public read product-media" ON storage.objects FOR SELECT USING (bucket_id = 'product-media');
  `;

  // Use the REST API to execute the query, wait I don't have direct SQL access through JS client without rpc.
  // We can just ask the user to run it via the dashboard, OR I can see if we can do something else.
  console.log("SQL generated.", sql);
}

setStoragePolicies();

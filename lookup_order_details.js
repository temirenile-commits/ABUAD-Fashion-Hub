const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // 1. Get customer
  console.log("Looking up customer...");
  const { data: customer, error: customerErr } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'successosemuahu803@gmail.com')
    .single();
  
  if (customerErr) {
    console.error("Error fetching customer:", customerErr);
  } else {
    console.log("Found customer:", customer.id, customer.full_name);
  }

  // 2. Get vendor
  console.log("Looking up vendor...");
  const { data: vendor, error: vendorErr } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'temirenile@gmail.com')
    .single();

  if (vendorErr) {
    console.error("Error fetching vendor user:", vendorErr);
  } else {
    console.log("Found vendor user:", vendor.id);
  }

  // Look up brand
  const { data: brand, error: brandErr } = await supabase
    .from('brands')
    .select('*')
    .ilike('name', '%vaxxi%')
    .single();

  if (brandErr) {
    console.error("Error fetching brand:", brandErr);
    // try by vendor id
    if (vendor) {
        const { data: brandByOwner } = await supabase.from('brands').select('*').eq('owner_id', vendor.id).single();
        console.log("Brand by owner:", brandByOwner);
    }
  } else {
    console.log("Found brand:", brand.id, brand.name, brand.university_id);
    
    // Look up product
    const { data: products } = await supabase
        .from('products')
        .select('*')
        .eq('brand_id', brand.id)
        .limit(1);
    
    if (products && products.length > 0) {
        console.log("Found product:", products[0].id, products[0].title, products[0].price);
    } else {
        console.log("No products found for brand.");
    }
  }
}

run();

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceRole) {
  console.error('Supabase credentials missing.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRole, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runSeed() {
  console.log('🌱 Starting Database Seeding...\n');

  try {
    // 1. Create a dummy vendor user
    console.log('Creating Test Vendor Auth Account...');
    const vendorEmail = `vendor_${Date.now()}@test.com`;
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: vendorEmail,
      password: 'password123',
      email_confirm: true,
    });
    
    if (authError) throw authError;
    const vendorUserId = authData.user.id;
    console.log(`✅ User created: ${vendorUserId}`);

    // Insert into public.users (triggers might do this automatically, but explicitly inserting out of caution based on current schema policy layout)
    await supabase.from('users').upsert({
      id: vendorUserId,
      name: 'RetroFits Admin',
      email: vendorEmail,
      role: 'vendor',
    });
    console.log('✅ User profile inserted.');

    // 2. Create the Brand
    console.log('\nCreating Brand...');
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .insert({
        owner_id: vendorUserId,
        name: 'RetroFits ABUAD',
        description: 'Vintage streetwear and thrifts guaranteed to turn heads on campus.',
        logo_url: 'https://images.unsplash.com/photo-1542272201-b1ca555f8505?w=500&auto=format&fit=crop&q=60',
        whatsapp_number: '+2348000000000',
        verified: true,
        delivery_preference: 'platform',
        subscription_plan: 'free',
      })
      .select()
      .single();

    if (brandError) throw brandError;
    console.log(`✅ Brand created: ${brand.id}`);

    // 3. Create Products
    console.log('\nCreating Products...');
    const productsToInsert = [
      {
        brand_id: brand.id,
        title: 'Vintage Oversized Denim Jacket',
        description: 'A timeless vintage oversized denim jacket perfect for any campus outfit.',
        price: 18500,
        original_price: 24000,
        category: 'Clothing',
        media_urls: ['https://images.unsplash.com/photo-1576871337645-2b05b7d159dd?w=800&auto=format&fit=crop'],
        is_featured: true,
      },
      {
        brand_id: brand.id,
        title: 'Woven Raffia Bucket Hat',
        description: 'Handcrafted raffia bucket hat. Perfect for sunny days.',
        price: 3500,
        original_price: 3500,
        category: 'Accessories',
        media_urls: ['https://images.unsplash.com/photo-1529566657388-c7e6cadd2d6f?w=800&auto=format&fit=crop'],
        is_featured: false,
      },
      {
        brand_id: brand.id,
        title: 'Graphic Print Crop Top',
        description: 'Y2K aesthetic graphic crop top.',
        price: 5500,
        original_price: 7000,
        category: 'Clothing',
        media_urls: ['https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&auto=format&fit=crop'],
        is_featured: true,
      }
    ];

    const { error: productsError } = await supabase.from('products').insert(productsToInsert);
    if (productsError) throw productsError;
    console.log(`✅ 3 Products created.`);

    // 4. Create Services
    console.log('\nCreating Services...');
    const { error: serviceError } = await supabase.from('services').insert({
      brand_id: brand.id,
      service_type: 'Stylist',
      title: 'Full Campus Wardrobe Styling',
      description: 'I will personally style your week-long campus outfits using thrifted gems.',
      price: 15000,
      portfolio_urls: ['https://images.unsplash.com/photo-1532453288672-3a27e9be9efd?w=800&auto=format&fit=crop'],
      is_featured: true
    });
    if (serviceError) throw serviceError;
    console.log(`✅ 1 Service created.`);

    console.log('\n🎉 Seeding Complete!');
    console.log(`Test Vendor Email: ${vendorEmail}`);
    console.log(`Test Vendor Password: password123`);

  } catch (err) {
    console.error('❌ Seeding failed:', err);
  }
}

runSeed();

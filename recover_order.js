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
  console.log("Starting manual order recovery...");

  // IDs from previous lookup
  const customerId = "292e58e8-ebc6-487a-b3d0-f48ac9c68b58"; // Success Osemuahu
  const vendorUserId = "e43f0d1a-3ec0-4ba0-a05a-788577d30e1a"; // temirenile@gmail.com
  const brandId = "4355e799-b74b-4b1e-b4e1-a0e1680b7b67"; // Vaxxi
  const universityId = "00000000-0000-0000-0000-000000000001"; // ABUAD
  const productId = "817fbfa0-7f99-4364-abf7-08db05a464fa"; // Green T-shirt (8000)

  const price = 8000;
  const deliveryFee = 1500;
  const commissionRate = 0.075;

  const totalAmount = price + deliveryFee; // 9500
  const baseCommission = price * commissionRate; // 600
  const vendorEarning = price - baseCommission; // 7400
  const totalCommissionForRecord = baseCommission + deliveryFee; // 2100

  const deliveryCode = Math.floor(100000 + Math.random() * 900000).toString();
  const paystackRef = `MANUAL-RECOVERY-${Date.now()}`;
  
  const now = new Date();
  const deliveredAt = now.toISOString();
  // Maturity date: 24h from now
  const maturityDate = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  // 1. Insert Order
  console.log("Inserting order...");
  const { data: orderData, error: orderErr } = await supabase.from('orders').insert({
    customer_id: customerId,
    brand_id: brandId,
    product_id: productId,
    quantity: 1,
    total_amount: totalAmount,
    commission_amount: totalCommissionForRecord,
    vendor_earning: vendorEarning,
    status: 'delivered', // Skipped pending -> paid -> ready -> in_transit -> delivered
    delivery_method: 'platform',
    delivery_scope: 'in-school',
    assigned_delivery_system: 'platform',
    shipping_address: 'ABUAD Campus (Recovered Order)',
    paystack_reference: paystackRef,
    expires_at: null,
    admin_discount: 0,
    delivery_code: deliveryCode,
    delivery_fee_charged: deliveryFee,
    university_id: universityId,
    delivered_at: deliveredAt,
    payout_ready_at: maturityDate
  }).select().single();

  if (orderErr) {
    console.error("Failed to insert order:", orderErr);
    process.exit(1);
  }

  const orderId = orderData.id;
  console.log(`Order inserted: ${orderId}`);

  // 2. Fetch Brand Data for Delivery Location
  const { data: brandData } = await supabase.from('brands').select('latitude, longitude, sales_count').eq('id', brandId).single();

  // 3. Insert Delivery
  console.log("Inserting delivery record...");
  const { error: deliveryErr } = await supabase.from('deliveries').insert({
    order_id: orderId,
    status: 'delivered', // already completed
    pickup_lat: brandData?.latitude || 0,
    pickup_long: brandData?.longitude || 0,
  });

  if (deliveryErr) console.error("Delivery insert error (non-fatal):", deliveryErr);

  // 4. Record Transaction
  console.log("Inserting transaction record...");
  const { error: transErr } = await supabase.from('transactions').insert({
    order_id: orderId,
    brand_id: brandId,
    user_id: customerId,
    type: 'payment_in',
    amount: totalAmount,
    status: 'success',
    description: `Escrow payment secured for manual recovery order #${orderId.slice(0, 8)}`,
  });

  if (transErr) console.error("Transaction insert error (non-fatal):", transErr);

  // 5. Update Vendor Wallet (Pending Balance)
  console.log("Updating vendor wallet pending balance...");
  const { error: walletErr } = await supabase.rpc('adjust_vendor_wallet', {
    p_brand_id: brandId,
    p_pending_delta: vendorEarning
  });

  if (walletErr) console.error("Wallet update error (non-fatal):", walletErr);

  // 6. Update Brand Sales Count
  console.log("Updating brand sales count...");
  const { error: salesErr } = await supabase.from('brands').update({
    sales_count: (brandData?.sales_count || 0) + 1
  }).eq('id', brandId);

  if (salesErr) console.error("Sales count update error (non-fatal):", salesErr);

  console.log("✅ Recovery complete! Order should now be visible in University Admin and Vendor dashboards.");
}

run();

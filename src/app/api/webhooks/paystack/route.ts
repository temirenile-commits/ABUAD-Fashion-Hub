import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyTransaction } from '@/lib/paystack';

const secret = process.env.PAYSTACK_SECRET_KEY || '';

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-paystack-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    // 1. Verify Signature (First Layer)
    const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
    if (hash !== signature) {
      console.error('Invalid signatures matching');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(rawBody);

    if (event.event === 'charge.success') {
      const reference = event.data.reference;

      // 2. Double Verification (Second Layer - Cross check with Paystack API)
      const verification = await verifyTransaction(reference);
      
      if (!verification.status || verification.data.status !== 'success') {
        console.error('Paystack verification failed for ref:', reference);
        return NextResponse.json({ error: 'Transaction verification failed' }, { status: 400 });
      }

      const metadata = verification.data.metadata || {};
      console.log(`[PAYSTACK WEBHOOK] Verified ${reference} successfully via API. Payment Type: ${metadata.payment_type}`);

      // Case A: Vendor Activation Fee
      if (metadata.payment_type === 'vendor_activation_fee') {
        const { brand_id } = metadata;
        const { error: brandUpdateError } = await supabaseAdmin
          .from('brands')
          .update({ 
            fee_paid: true, 
            verification_status: 'verified',
            verified: true 
          })
          .eq('id', brand_id);
        
        if (brandUpdateError) {
          console.error('Error activating brand:', brandUpdateError);
          return NextResponse.json({ error: 'Brand activation failed' }, { status: 500 });
        }
        
        console.log(`[WEBHOOK] Brand ${brand_id} activated successfully!`);
        return NextResponse.json({ status: 'success' }, { status: 200 });
      }

      // Case C: Vendor Tiered Subscription & Boosts
      if (metadata.payment_type === 'vendor_subscription') {
        const { brand_id, tier } = metadata;
        
        // 1. Handle Visibility Boosts
        const { data: boostSettings } = await supabaseAdmin.from('platform_settings').select('value').eq('key', 'boost_rates').single();
        const boostRates = (boostSettings?.value as any[]) || [];
        const boostConfig = boostRates.find(b => b.id === tier);

        if (boostConfig) {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + (boostConfig.duration_days || 7));

          const { error: boostError } = await supabaseAdmin
            .from('brands')
            .update({ 
               boost_level: tier,
               boost_expires_at: expiresAt.toISOString(),
               visibility_score: 100 + (boostConfig.visibility_score || 50) 
            })
            .eq('id', brand_id);
          
          if (boostError) return NextResponse.json({ error: 'Boost update failed' }, { status: 500 });
          return NextResponse.json({ status: 'success' }, { status: 200 });
        }

        // 1.1 Handle Billboard Boost (₦500/week)
        if (tier === 'billboard_boost') {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 7);

          const { error } = await supabaseAdmin
            .from('brands')
            .update({ billboard_boost_expires_at: expiresAt.toISOString() })
            .eq('id', brand_id);
          
          if (error) return NextResponse.json({ error: 'Billboard boost failed' }, { status: 500 });
          return NextResponse.json({ status: 'success' }, { status: 200 });
        }

        // 2. Handle System Plans
        const { data: subSettings } = await supabaseAdmin.from('platform_settings').select('value').eq('key', 'subscription_rates').single();
        const subRates = (subSettings?.value as any[]) || [];
        const planConfig = subRates.find(r => r.id === tier) || { max_products: 10, max_reels: 1 };

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        const { error: subError } = await supabaseAdmin
          .from('brands')
          .update({ 
            subscription_tier: tier, 
            subscription_expires_at: expiresAt.toISOString(),
            max_products: planConfig.max_products || 10,
            max_reels: planConfig.max_reels || 1
          })
          .eq('id', brand_id);

        if (subError) {
          console.error('Error updating subscription:', subError);
          return NextResponse.json({ error: 'Subscription update failed' }, { status: 500 });
        }

        // 3. Add Listing Credits
        const creditsToAdd = planConfig.max_products || 10;
        await supabaseAdmin.rpc('add_listing_credits', { p_brand_id: brand_id, p_count: creditsToAdd });

        console.log(`[WEBHOOK] Subscription for ${brand_id} updated to ${tier} with ${creditsToAdd} credits!`);
        return NextResponse.json({ status: 'success' }, { status: 200 });
      }

      // Case B: Customer Orders (Default)
      // 1. Fetch all orders with this Paystack reference
      const { data: orders, error: fetchError } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('paystack_reference', reference);

      if (fetchError || !orders || orders.length === 0) {
        console.error('No orders found for reference:', reference, fetchError);
        return NextResponse.json({ error: 'Orders not found' }, { status: 404 });
      }

      // 2. Update all these orders to 'paid' (Securing Escrow)
      const totalExpected = orders.reduce((sum, o) => sum + Number(o.total_amount), 0);
      const paidAmount = verification.data.amount / 100;

      // STRICT VERIFICATION: Ensure paid amount matches expected amount (tolerance of 1 Naira for rounding)
      if (Math.abs(paidAmount - totalExpected) > 1) {
        console.error(`[WEBHOOK] Amount mismatch for ref ${reference}: Expected ₦${totalExpected}, Paid ₦${paidAmount}`);
        return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
      }

      const { error: updateError } = await supabaseAdmin
        .from('orders')
        .update({ status: 'paid' })
        .eq('paystack_reference', reference);

      if (updateError) {
        console.error('Error updating orders batch:', updateError);
        return NextResponse.json({ error: 'Batch update failed' }, { status: 500 });
      }

      // 3. Automated Email Notification (Fire and forget)
      const { sendEmail, emailTemplates } = await import('@/lib/mail');
      const { data: customer } = await supabaseAdmin.from('users').select('email, name').eq('id', orders[0].customer_id).single();
      if (customer?.email) {
        sendEmail({
          to: customer.email,
          subject: 'Payment Secured! 🎉 Master Cart',
          html: emailTemplates.paymentSuccess(customer.name || '', reference.slice(-8), `₦${paidAmount.toLocaleString()}`)
        });
      }

      // 4. RAPID FULFILLMENT: Batch process each order
      const fulfillmentPromises = orders.map(async (order) => {
        // A. Parallel Fetch: Vendor Data & Stock Decrement
        const [{ data: brandData }, _] = await Promise.all([
          supabaseAdmin.from('brands').select('owner_id, sales_count, latitude, longitude').eq('id', order.brand_id).single(),
          supabaseAdmin.rpc('decrement_product_stock', { prod_id: order.product_id, qty: order.quantity || 1 })
        ]);

        const vendorUserId = brandData?.owner_id;

        // B. Update Brand Metrics (for Trendy Ranking)
        await supabaseAdmin.from('brands').update({ 
          sales_count: (brandData?.sales_count || 0) + (order.quantity || 1) 
        }).eq('id', order.brand_id);

        // C. Record Financial Transaction (Escrow) & Update Wallet
        const transRecord = {
          order_id: order.id,
          brand_id: order.brand_id,
          user_id: order.customer_id,
          type: 'payment_in',
          amount: order.total_amount,
          status: 'success',
          description: `Escrow payment secured for order #${order.id.slice(0, 8)}`,
        };

        // Update vendor wallet (Pending Balance)
        await supabaseAdmin.rpc('adjust_vendor_wallet', {
          p_brand_id: order.brand_id,
          p_pending_delta: order.vendor_earning
        });

        // D. Create Dual Notifications
        const notifs = [
          {
            user_id: order.customer_id,
            type: 'order_update',
            title: 'Order Confirmed! 🎉',
            content: `Your payment has been secured. The vendor is now preparing your order #${order.id.slice(0, 8)}.`,
            link: '/dashboard/customer',
          }
        ];

        if (vendorUserId) {
          notifs.push({
            user_id: vendorUserId,
            type: 'new_order',
            title: 'You have a new order! 💸',
            content: `A customer just purchased an item. Start processing order #${order.id.slice(0, 8)} to release your funds.`,
            link: '/dashboard/vendor',
          });
        }

        // E. FINAL BATCH EXECUTION: Notifications & Transactions
        await Promise.all([
          supabaseAdmin.from('transactions').insert(transRecord),
          supabaseAdmin.from('notifications').insert(notifs)
        ]);

        // F. LOGISTICS: Auto-Assignment
        if (order.delivery_method === 'platform') {
          // 1. Create the delivery record first
          await supabaseAdmin.from('deliveries').insert({
             order_id: order.id,
             status: 'pending'
          });

          // 2. Assign to nearest agent
          if (brandData?.latitude && brandData?.longitude) {
            const { autoAssignDelivery } = await import('@/lib/logistics');
            await autoAssignDelivery(order.id, Number(brandData.latitude), Number(brandData.longitude));
          }
        }
      });

      await Promise.all(fulfillmentPromises);

      console.log(`[WEBHOOK] ${orders.length} orders processed successfully for reference ${reference}`);
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

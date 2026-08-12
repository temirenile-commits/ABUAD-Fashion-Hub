import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyTransaction } from '@/lib/paystack';
import { paymentErrorResponse, reconcileVerifiedVendorPayment, VENDOR_PAYMENT_TYPES } from '@/lib/vendor-payment';

const secret = process.env.PAYSTACK_SECRET_KEY || '';

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-paystack-signature');

    if (!secret) {
      console.error('[WEBHOOK] PAYSTACK_SECRET_KEY is not configured');
      return NextResponse.json({ error: 'Webhook configuration error' }, { status: 500 });
    }
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    // 1. Verify Signature (First Layer) with constant-time comparison.
    const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
    const expectedSignature = Buffer.from(hash, 'utf8');
    const actualSignature = Buffer.from(signature, 'utf8');
    if (expectedSignature.length !== actualSignature.length || !crypto.timingSafeEqual(expectedSignature, actualSignature)) {
      console.error('[WEBHOOK] Invalid Paystack signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(rawBody);

    if (event.event === 'charge.success') {
      const reference = event.data?.reference;
      if (typeof reference !== 'string' || !reference.trim()) {
        return NextResponse.json({ error: 'Missing payment reference' }, { status: 400 });
      }

      // 2. Double Verification (Second Layer - Cross check with Paystack API)
      const verification = await verifyTransaction(reference);
      
      if (!verification.status || verification.data.status !== 'success') {
        console.error('Paystack verification failed for ref:', reference);
        return NextResponse.json({ error: 'Transaction verification failed' }, { status: 400 });
      }
      if (verification.data.reference !== reference) {
        return NextResponse.json({ error: 'Payment reference mismatch' }, { status: 400 });
      }

      const metadata = verification.data.metadata || {};
      console.log(`[PAYSTACK WEBHOOK] Verified ${reference} successfully via API. Payment Type: ${metadata.payment_type}`);

      // All vendor-side payments are reconciled through one exactly-once, ownership-checked path.
      if (VENDOR_PAYMENT_TYPES.includes(metadata.payment_type)) {
        const result = await reconcileVerifiedVendorPayment(verification.data, 'webhook');
        console.log('[WEBHOOK] Vendor payment reconciled:', {
          reference,
          payment_type: result.paymentType,
          processed: result.processed,
          duplicate: result.duplicate,
          credits_added: result.creditsAdded,
        });
        return NextResponse.json({ ...result, status: 'success' }, { status: 200 });
      }

      // Customer Orders (Default)
      // 1. Fetch all orders with this Paystack reference
      const { data: orders, error: fetchError } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('paystack_reference', reference);

      if (fetchError || !orders || orders.length === 0) {
        console.error('No orders found for reference:', reference, fetchError);
        return NextResponse.json({ error: 'Orders not found' }, { status: 404 });
      }

      // 2. Update all these orders - split by type for correct status routing
      const totalExpected = orders.reduce((sum, o) => sum + Number(o.total_amount), 0);
      const paidAmount = verification.data.amount / 100;

      // Generate a unique 6-digit delivery code for this batch
      const deliveryCode = Math.floor(100000 + Math.random() * 900000).toString();

      // STRICT VERIFICATION: Ensure paid amount matches expected amount (tolerance of 1 Naira for rounding)
      if (Math.abs(paidAmount - totalExpected) > 1) {
        console.error(`[WEBHOOK] Amount mismatch for ref ${reference}: Expected ₦${totalExpected}, Paid ₦${paidAmount}`);
        return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
      }

      // Separate normal orders from pre-orders
      const normalOrderIds = orders.filter(o => o.status === 'pending').map(o => o.id);
      const preorderIds = orders.filter(o => o.status === 'preorder_pending').map(o => o.id);

      const updatePromises = [];
      if (normalOrderIds.length > 0) {
        updatePromises.push(
          supabaseAdmin.from('orders').update({ 
            status: 'paid',
            delivery_code: deliveryCode,
            expires_at: null
          }).in('id', normalOrderIds)
        );
      }
      if (preorderIds.length > 0) {
        updatePromises.push(
          supabaseAdmin.from('orders').update({ 
            status: 'preorder_paid',
            delivery_code: deliveryCode,
            expires_at: null
          }).in('id', preorderIds)
        );
      }

      let results = await Promise.all(updatePromises);
      let updateError = results.find(r => r.error)?.error;

      if (updateError && updateError.message.includes('schema cache')) {
        console.warn('[WEBHOOK] Schema cache error during order update. Retrying without delivery_code.');
        const retryPromises = [];
        if (normalOrderIds.length > 0) {
          retryPromises.push(
            supabaseAdmin.from('orders').update({ 
              status: 'paid',
              expires_at: null
            }).in('id', normalOrderIds)
          );
        }
        if (preorderIds.length > 0) {
          retryPromises.push(
            supabaseAdmin.from('orders').update({ 
              status: 'preorder_paid',
              expires_at: null
            }).in('id', preorderIds)
          );
        }
        results = await Promise.all(retryPromises);
        updateError = results.find(r => r.error)?.error;
      }

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
          subject: 'Payment Secured! 🎊 MasterCart',
          html: emailTemplates.paymentSuccess(
            customer.name || '', 
            reference.slice(-8), 
            `₦${paidAmount.toLocaleString()}`,
            deliveryCode // Pass the code to the template
          )
        });
      }

      // 4. RAPID FULFILLMENT: Batch process each order
      const fulfillmentPromises = orders.map(async (order) => {
        // A. Parallel Fetch: Vendor Data & Stock Decrement
        const [{ data: brandData }, _] = await Promise.all([
          supabaseAdmin.from('brands').select('owner_id, sales_count, weekly_orders, latitude, longitude').eq('id', order.brand_id).single(),
          supabaseAdmin.rpc('decrement_product_stock', { prod_id: order.product_id, qty: order.quantity || 1 })
        ]);

        // Auto-Drafting: Check if stock hit zero
        const { data: updatedProd } = await supabaseAdmin.from('products').select('stock_count').eq('id', order.product_id).single();
        if (updatedProd && updatedProd.stock_count <= 0) {
          await supabaseAdmin.from('products').update({ 
            is_draft: true,
            updated_at: new Date().toISOString() 
          }).eq('id', order.product_id);
        }

        // Increment weekly_sold for product
        await supabaseAdmin.rpc('increment_product_weekly_sold', { prod_id: order.product_id, qty: order.quantity || 1 });

        const vendorUserId = brandData?.owner_id;

        // B. Update Brand Metrics (for Trendy Ranking)
        await supabaseAdmin.from('brands').update({ 
          sales_count: (brandData?.sales_count || 0) + (order.quantity || 1),
          weekly_orders: (brandData?.weekly_orders || 0) + (order.quantity || 1)
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
            title: 'Order Confirmed! 🎊',
            content: `Your payment has been secured. Your delivery code is ${deliveryCode}. Share this ONLY with the delivery agent.`,
            link: '/dashboard/customer',
          }
        ];

        if (vendorUserId) {
          notifs.push({
            user_id: vendorUserId,
            type: 'new_order',
            title: 'You have a new order! ðŸ’¸',
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
          // 1. Fetch university config for dynamic rider payout
          let riderPayout = 500;
          if (order.university_id) {
            const { data: uniConfigData } = await supabaseAdmin
              .from('platform_settings')
              .select('value')
              .eq('key', `uni_config_${order.university_id}`)
              .single();
            if (uniConfigData && (uniConfigData.value as any)?.delivery_rider_pay) {
              riderPayout = Number((uniConfigData.value as any).delivery_rider_pay);
            }
          }

          // 2. Create the delivery record first, but hide it from agents until vendor marks 'ready'
          await supabaseAdmin.from('deliveries').insert({
             order_id: order.id,
             status: 'waiting_for_vendor',
             delivery_fee: riderPayout
          });

          // 2. Assign to nearest agent
          if (brandData?.latitude && brandData?.longitude) {
            const { autoAssignDelivery } = await import('@/lib/logistics');
            await autoAssignDelivery(order.id, Number(brandData.latitude), Number(brandData.longitude));
          }
        }
      });

      await Promise.all(fulfillmentPromises);

      // 5. PROMO CODE SUBSIDY & USAGE TRACKING
      if (metadata.promo_code_id) {
         const { data: promo } = await supabaseAdmin.from('promo_codes').select('capital_used, subsidiary_capital, current_uses').eq('id', metadata.promo_code_id).single();
         if (promo) {
            const newCapitalUsed = Number(promo.capital_used || 0) + Number(metadata.total_discount_applied || 0);
            const newUses = Number(promo.current_uses || 0) + 1;
            
            const updatePayload: any = { 
               capital_used: newCapitalUsed,
               current_uses: newUses
            };
            
            // Auto-deactivate if budget hit
            if (promo.subsidiary_capital > 0 && newCapitalUsed >= promo.subsidiary_capital) {
               updatePayload.is_active = false;
               console.log(`[WEBHOOK] Promo ${metadata.promo_code_id} exhausted its capital and is now inactive.`);
            }

            await supabaseAdmin.from('promo_codes').update(updatePayload).eq('id', metadata.promo_code_id);
         }
      }

      console.log(`[WEBHOOK] ${orders.length} orders processed successfully for reference ${reference}`);
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });

  } catch (error) {
    const result = paymentErrorResponse(error);
    console.error('[WEBHOOK] Payment processing failed:', result.body);
    return NextResponse.json(result.body, { status: result.status });
  }
}


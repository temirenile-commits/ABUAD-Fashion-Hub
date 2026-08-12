import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { initializeTransaction } from '@/lib/paystack';
import { getAuthenticatedUser } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

const POSTING_CREDIT_PACKAGES = [5, 10, 20, 50];

type PaymentType = 'vendor_subscription' | 'posting_credits_purchase' | 'delicacies_credit_purchase';

function numberValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function creditPrice(value: unknown): number | null {
  if (typeof value === 'object' && value !== null) {
    const record = value as { price?: unknown; price_per_day?: unknown };
    if (record.price !== undefined) return numberValue(record.price);
    if (record.price_per_day !== undefined) return numberValue(record.price_per_day);
  }
  return numberValue(value);
}

function isConfiguredBoost(settings: any[], tierId: string): boolean {
  const boosts = settings.find(s => s.key === 'boost_rates')?.value;
  return Array.isArray(boosts) && boosts.some((boost: any) => boost.id === tierId);
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const body = await req.json();
    const brandId = typeof body.brandId === 'string' ? body.brandId : '';
    const tierId = typeof body.tierId === 'string' ? body.tierId : '';
    const paymentType = (body.paymentType || 'vendor_subscription') as PaymentType;
    const requestedCredits = Number(body.credits);

    if (!brandId || !tierId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    if (!['vendor_subscription', 'posting_credits_purchase', 'delicacies_credit_purchase'].includes(paymentType)) {
      return NextResponse.json({ error: 'Unsupported payment type' }, { status: 400 });
    }

    const [{ data: userProfile, error: userError }, { data: brand, error: brandError }, { data: settingsData, error: settingsError }] = await Promise.all([
      supabaseAdmin.from('users').select('email').eq('id', user.id).maybeSingle(),
      supabaseAdmin.from('brands').select('id, owner_id, university_id, marketplace_type').eq('id', brandId).maybeSingle(),
      supabaseAdmin.from('platform_settings').select('key, value'),
    ]);

    if (userError || brandError || settingsError) {
      const error = userError || brandError || settingsError;
      console.error('[Paystack Init] Live settings lookup failed:', {
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
      });
      return NextResponse.json({ error: 'Payment configuration lookup failed' }, { status: 500 });
    }

    if (!brand) return NextResponse.json({ error: 'Brand profile not found' }, { status: 404 });
    if (brand.owner_id !== user.id) return NextResponse.json({ error: 'Unauthorized brand payment' }, { status: 403 });
    if (paymentType === 'delicacies_credit_purchase' && brand.marketplace_type !== 'delicacies') {
      return NextResponse.json({ error: 'Delicacies credits require a delicacies brand' }, { status: 400 });
    }
    if (paymentType === 'posting_credits_purchase' && brand.marketplace_type === 'delicacies') {
      return NextResponse.json({ error: 'Use delicacies credits for a delicacies brand' }, { status: 400 });
    }

    const settings = settingsData || [];
    let expectedAmount: number | null = null;
    let credits = 0;
    let packageId = tierId;
    let matchedConfig: any = null;

    if (paymentType === 'posting_credits_purchase') {
      const packageMatch = /^credits_(\d+)$/.exec(tierId);
      const packageCredits = packageMatch ? Number(packageMatch[1]) : requestedCredits;
      if (!Number.isInteger(packageCredits) || !POSTING_CREDIT_PACKAGES.includes(packageCredits)) {
        return NextResponse.json({ error: 'Invalid posting-credit package' }, { status: 400 });
      }

      const globalPrice = creditPrice(settings.find(s => s.key === 'credit_price')?.value);
      if (globalPrice === null || globalPrice <= 0) {
        return NextResponse.json({ error: 'Posting-credit pricing is not configured' }, { status: 503 });
      }

      credits = packageCredits;
      packageId = `credits_${packageCredits}`;
      expectedAmount = credits * globalPrice;
    } else if (paymentType === 'delicacies_credit_purchase') {
      if (!Number.isInteger(requestedCredits) || requestedCredits <= 0 || requestedCredits > 500) {
        return NextResponse.json({ error: 'Invalid delicacies credit count' }, { status: 400 });
      }

      const configuredPrice = creditPrice(settings.find(s => s.key === 'delicacies_credit_price')?.value);
      if (configuredPrice === null || configuredPrice <= 0) {
        return NextResponse.json({ error: 'Delicacies-credit pricing is not configured' }, { status: 503 });
      }

      credits = requestedCredits;
      packageId = `credits_${credits}`;
      expectedAmount = credits * configuredPrice;
    } else {
      const subscriptionRates = settings.find(s => s.key === 'subscription_rates')?.value;
      const boostRates = settings.find(s => s.key === 'boost_rates')?.value;
      const subRates = Array.isArray(subscriptionRates) ? subscriptionRates : [];
      const boosts = Array.isArray(boostRates) ? boostRates : [];
      const billboardSetting = settings.find(s => s.key === 'delicacies_billboard_price')?.value;
      const isBillboard = tierId === 'billboard_boost';

      matchedConfig = isBillboard
        ? { id: tierId, price: creditPrice(billboardSetting), duration_days: 7, benefit_kind: 'billboard' }
        : subRates.find((rate: any) => rate.id === tierId) || boosts.find((boost: any) => boost.id === tierId);
      if (!matchedConfig) return NextResponse.json({ error: 'Payment tier is not configured' }, { status: 400 });

      let configured = numberValue(matchedConfig.price);
      if (brand.university_id) {
        const uniConfig = settingsData?.find(s => s.key === `uni_config_${brand.university_id}`)?.value as any;
        if (paymentType === 'vendor_subscription' && uniConfig?.plans?.[tierId]?.price !== undefined) {
          configured = numberValue(uniConfig.plans[tierId].price);
        }
      } else if (configured !== null && configured > 0) {
        configured *= 5;
      }

      if (configured === null || configured <= 0) {
        return NextResponse.json({ error: 'Payment tier price is not configured' }, { status: 503 });
      }

      expectedAmount = configured;
      if (paymentType === 'vendor_subscription') {
        credits = Number(matchedConfig.upload_credits ?? matchedConfig.max_products ?? 0);
        if (!Number.isInteger(credits) || credits < 0) credits = 0;
      }
    }

    if (expectedAmount === null || expectedAmount <= 0) {
      return NextResponse.json({ error: 'Payment amount is not valid' }, { status: 503 });
    }

    const reference = `SUB-${paymentType.toUpperCase()}-${brandId}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const origin = req.headers.get('origin') || 'https://mastercart.vercel.app';
    const callbackUrl = `${origin}/dashboard/vendor?ref=${encodeURIComponent(reference)}`;

    const metadata = {
      payment_type: paymentType,
      brand_id: brandId,
      user_id: user.id,
      credits,
      package_id: packageId,
      tier: tierId,
      expected_amount: expectedAmount,
      reference,
      benefit_kind: paymentType === 'vendor_subscription'
        ? (matchedConfig?.benefit_kind || (tierId === 'billboard_boost' ? 'billboard' : (isConfiguredBoost(settings, tierId) ? 'boost' : 'subscription')))
        : 'credits',
      duration_days: Number(matchedConfig?.duration_days || (tierId === 'billboard_boost' ? 7 : 30)),
      max_products: Number(matchedConfig?.max_products || 0),
      max_reels: Number(matchedConfig?.max_reels || 0),
      visibility_score: Number(matchedConfig?.visibility_score || 50),
    };

    const { error: pendingError } = await supabaseAdmin.from('transactions').insert({
      brand_id: brandId,
      user_id: user.id,
      type: 'payment_in',
      amount: expectedAmount,
      expected_amount: expectedAmount,
      status: 'pending',
      description: `Pending ${paymentType} payment ${reference}`,
      payment_reference: reference,
      payment_type: paymentType,
      credits,
      metadata,
    });

    if (pendingError) {
      console.error('[Paystack Init] Pending transaction insert failed:', {
        code: pendingError.code,
        message: pendingError.message,
        details: pendingError.details,
        hint: pendingError.hint,
      });
      return NextResponse.json({ error: 'Could not create payment record' }, { status: 500 });
    }

    try {
      const paystackResponse = await initializeTransaction({
        email: user.email || userProfile?.email || 'vendor@mastercart.com',
        amount: expectedAmount,
        reference,
        callback_url: callbackUrl,
        metadata,
      });

      return NextResponse.json({
        success: true,
        authorization_url: paystackResponse.authorization_url,
        reference,
        payment_type: paymentType,
        expected_amount: expectedAmount,
        credits,
      });
    } catch (error) {
      await supabaseAdmin.from('transactions').update({ status: 'failed' }).eq('payment_reference', reference).eq('status', 'pending');
      throw error;
    }
  } catch (error: any) {
    console.error('[Paystack Init] Error:', {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
    });
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { initializeTransaction } from '@/lib/paystack';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { userId, brandId, tierId, amount } = await req.json();

    if (!userId || !brandId || !tierId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // 1. Fetch User and Brand details
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    const { data: brandData } = await supabaseAdmin
      .from('brands')
      .select('university_id')
      .eq('id', brandId)
      .single();

    // 2. Server-side Price Verification (Crucial Fix)
    const { data: settingsData } = await supabaseAdmin.from('platform_settings').select('key, value');
    const settings = settingsData || [];
    
    let finalSubRates = settings.find(s => s.key === 'subscription_rates')?.value || [];
    let finalBoostRates = settings.find(s => s.key === 'boost_rates')?.value || [];

    if (brandData?.university_id) {
        const uniConfig = settings.find(s => s.key === `uni_config_${brandData.university_id}`)?.value || {};
        
        finalSubRates = finalSubRates.map((rate: any) => {
           if (uniConfig.plans?.[rate.id]) {
             return { ...rate, price: Number(uniConfig.plans[rate.id].price) };
           }
           return rate;
        });

        if (uniConfig.boosters) {
            finalBoostRates = [
                { id: 'rodeo', price: uniConfig.boosters.rodeo?.price || 1000 },
                { id: 'nitro', price: uniConfig.boosters.nitro?.price || 2500 },
                { id: 'apex', price: uniConfig.boosters.apex?.price || 5000 },
                { id: 'billboard', price: uniConfig.billboard_price || 10000 }
            ];
        } else {
            // Also map billboard if boosts aren't fully configured
            finalBoostRates.push({ id: 'billboard', price: uniConfig.billboard_price || 10000 });
        }
    } else {
        finalSubRates = finalSubRates.map((rate: any) => ({
            ...rate,
            price: rate.price === 0 ? 0 : rate.price * 5
        }));
        finalBoostRates = finalBoostRates.map((boost: any) => ({
            ...boost,
            price: boost.price * 5
        }));
    }

    const matchedTier = finalSubRates.find((r: any) => r.id === tierId) || finalBoostRates.find((b: any) => b.id === tierId);
    const verifiedAmount = matchedTier ? Number(matchedTier.price) : Number(amount);

    if (!matchedTier) {
      console.warn(`[Paystack Init] Tier ${tierId} not found in server settings. Falling back to client amount: ${amount}`);
    }

    const reference = `SUB-${tierId.toUpperCase()}-${brandId}-${Date.now()}`;
    const host = req.headers.get('host') || 'mastercart.com';
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const baseDomain = host.includes('localhost') ? `${protocol}://${host}` : 'https://mastercart.com';

    // 3. Initialize Paystack
    const paystackParams = {
      email: userProfile?.email || 'vendor@mastercart.com',
      amount: verifiedAmount, 
      reference: reference,
      callback_url: `${baseDomain}/dashboard/vendor`,
      metadata: {
        payment_type: 'vendor_subscription',
        brand_id: brandId,
        user_id: userId,
        tier: tierId
      },
    };

    const paystackResponse = await initializeTransaction(paystackParams);

    return NextResponse.json({
      success: true,
      authorization_url: paystackResponse.authorization_url,
    });

  } catch (error: any) {
    console.error('Subscription error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

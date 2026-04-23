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

    // 1. Fetch User details
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    const reference = `SUB-${tierId.toUpperCase()}-${brandId}-${Date.now()}`;
    const host = req.headers.get('host') || 'abuadfashionhub.com';
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const baseDomain = host.includes('localhost') ? `${protocol}://${host}` : 'https://abuadfashionhub.com';

    // 2. Initialize Paystack
    const paystackParams = {
      email: userProfile?.email || 'vendor@abuadfashionhub.com',
      amount: amount, 
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

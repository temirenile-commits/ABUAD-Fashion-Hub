import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { initializeTransaction } from '@/lib/paystack';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { userId, brandId, tierId, amount } = await req.json();

    if (!userId || !brandId || !tierId || !amount) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // 1. Fetch User details
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    const reference = `SUB-${tierId.toUpperCase()}-${brandId}-${Date.now()}`;
    const origin = req.headers.get('origin') || 'https://abuad-fashion-hub.vercel.app';

    // 2. Initialize Paystack
    const paystackParams = {
      email: userProfile?.email || 'vendor@abuadfashionhub.com',
      amount: amount, // The user passes the amount from the frontend (5000, 10000, 20000)
      reference: reference,
      callback_url: `${origin}/dashboard/vendor`,
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

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { initializeTransaction } from '@/lib/paystack';

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // 1. Fetch User and Brand details
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    const { data: brand } = await supabaseAdmin
      .from('brands')
      .select('id, name')
      .eq('owner_id', userId)
      .single();

    if (!brand) {
      return NextResponse.json({ error: 'Brand profile not found' }, { status: 404 });
    }

    const amount = 2000; // NGN
    const reference = `VNDR-FEE-${brand.id}-${Date.now()}`;
    const origin = req.headers.get('origin') || 'https://abuad-fashion-hub.vercel.app';

    // 2. Initialize Paystack
    const paystackParams = {
      email: userProfile?.email || 'vendor@abuadfashionhub.com',
      amount: amount,
      reference: reference,
      callback_url: `${origin}/dashboard/vendor`,
      metadata: {
        payment_type: 'vendor_activation_fee',
        brand_id: brand.id,
        user_id: userId
      },
    };

    const paystackResponse = await initializeTransaction(paystackParams);

    return NextResponse.json({
      success: true,
      authorization_url: paystackResponse.authorization_url,
    });

  } catch (error: any) {
    console.error('Activation fee error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

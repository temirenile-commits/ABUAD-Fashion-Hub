import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { initializeTransaction } from '@/lib/paystack';
import { getAuthenticatedUser } from '@/lib/server-auth';

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const { data: userProfile, error: userError } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', user.id)
      .maybeSingle();

    const { data: brand, error: brandError } = await supabaseAdmin
      .from('brands')
      .select('id, owner_id, name, university_id')
      .eq('owner_id', user.id)
      .maybeSingle();

    if (userError || brandError) {
      const error = userError || brandError;
      console.error('[Activation Fee] Lookup failed:', {
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
      });
      return NextResponse.json({ error: 'Brand payment lookup failed' }, { status: 500 });
    }

    if (!brand) return NextResponse.json({ error: 'Brand profile not found' }, { status: 404 });
    if (brand.owner_id !== user.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    let amount = 2000;
    const { data: settingsData, error: settingsError } = await supabaseAdmin
      .from('platform_settings')
      .select('key, value')
      .eq('key', 'activation_fee');
    if (settingsError) {
      console.error('[Activation Fee] Settings lookup failed:', {
        code: settingsError.code,
        message: settingsError.message,
        details: settingsError.details,
        hint: settingsError.hint,
      });
      return NextResponse.json({ error: 'Activation fee configuration lookup failed' }, { status: 500 });
    }

    const configuredAmount = settingsData?.find(s => s.key === 'activation_fee')?.value?.amount;
    if (Number(configuredAmount) > 0) amount = Number(configuredAmount);
    if (!brand.university_id) amount = 15000;

    const reference = `VNDR-FEE-${brand.id}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const origin = req.headers.get('origin') || 'https://mastercart.vercel.app';
    const metadata = {
      payment_type: 'vendor_activation_fee',
      brand_id: brand.id,
      user_id: user.id,
      credits: 0,
      expected_amount: amount,
      reference,
    };

    const { error: pendingError } = await supabaseAdmin.from('transactions').insert({
      brand_id: brand.id,
      user_id: user.id,
      type: 'payment_in',
      amount,
      expected_amount: amount,
      status: 'pending',
      description: `Pending vendor activation fee ${reference}`,
      payment_reference: reference,
      payment_type: 'vendor_activation_fee',
      credits: 0,
      metadata,
    });
    if (pendingError) {
      console.error('[Activation Fee] Pending transaction insert failed:', {
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
        amount,
        reference,
        callback_url: `${origin}/dashboard/vendor?ref=${encodeURIComponent(reference)}`,
        metadata,
      });

      return NextResponse.json({ success: true, authorization_url: paystackResponse.authorization_url, reference });
    } catch (error) {
      await supabaseAdmin.from('transactions').update({ status: 'failed' }).eq('payment_reference', reference).eq('status', 'pending');
      throw error;
    }
  } catch (error: any) {
    console.error('[Activation Fee] Error:', {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
    });
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const universityId = searchParams.get('universityId');

    if (!universityId) {
      return NextResponse.json({ error: 'University ID is required' }, { status: 400 });
    }

    // Fetch active billboards for the university
    const { data: billboards, error } = await supabaseAdmin
      .from('delicacies_billboards')
      .select(`
        id, 
        expires_at, 
        brands (id, name, logo_url, is_available_now),
        products (id, title, price, image_url, media_urls)
      `)
      .eq('university_id', universityId)
      .eq('active', true)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ billboards: billboards || [] });
  } catch (error: any) {
    console.error('Error fetching billboards:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId, brandId, universityId, productId, days } = await req.json();

    if (!userId || !brandId || !universityId || !days) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const durationDays = parseInt(days, 10);
    if (durationDays < 1) {
      return NextResponse.json({ error: 'Duration must be at least 1 day' }, { status: 400 });
    }

    // 1. Fetch Price Configuration
    const { data: config } = await supabaseAdmin
      .from('platform_settings')
      .select('value')
      .eq('key', 'delicacies_billboard_price')
      .single();

    const pricePerDay = config?.value?.price_per_day || 500;
    const totalCost = pricePerDay * durationDays;

    // 2. Fetch Wallet Balance
    const { data: walletData, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (walletError || !walletData || walletData.balance < totalCost) {
      return NextResponse.json({ error: `Insufficient wallet balance. You need ₦${totalCost}.` }, { status: 400 });
    }

    // 3. Deduct from wallet & Insert Billboard
    // Deduct via Supabase direct RPC if atomic_wallet deduction exists, 
    // but doing simple decrement as fallback just in case RPC fails due to unknown name
    const { error: deductError } = await supabaseAdmin.rpc('deduct_wallet_balance', {
       p_user_id: userId,
       p_amount: totalCost
    });

    if (deductError) {
       // Fallback manual deduction if RPC named differently
       const { error: updateError } = await supabaseAdmin
          .from('wallets')
          .update({ balance: walletData.balance - totalCost })
          .eq('user_id', userId);
       if (updateError) throw updateError;
    }

    // Record the transaction
    await supabaseAdmin.from('transactions').insert({
        user_id: userId,
        amount: totalCost,
        type: 'debit',
        status: 'success',
        reference: `BILLBOARD-${Date.now()}`,
        description: `Purchased Delicacies Billboard for ${durationDays} days`
    });

    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    // Insert Billboard
    const { data: newBillboard, error: insertError } = await supabaseAdmin
      .from('delicacies_billboards')
      .insert({
        brand_id: brandId,
        product_id: productId || null,
        university_id: universityId,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({ success: true, billboard: newBillboard });

  } catch (error: any) {
    console.error('Error purchasing billboard:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

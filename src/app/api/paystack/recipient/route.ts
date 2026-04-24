import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createTransferRecipient } from '@/lib/paystack';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { brandId, name, accountNumber, bankCode } = await req.json();

    if (!brandId || !name || !accountNumber || !bankCode) {
      return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
    }

    // 1. Check if recipient already exists for this brand
    const { data: brand } = await supabaseAdmin
      .from('brands')
      .select('recipient_code')
      .eq('id', brandId)
      .single();

    if (brand?.recipient_code) {
       return NextResponse.json({ success: true, recipient_code: brand.recipient_code });
    }

    // 2. Create recipient on Paystack
    const recipient = await createTransferRecipient(name, accountNumber, bankCode);

    // 3. Update brand record
    await supabaseAdmin
      .from('brands')
      .update({ 
        recipient_code: recipient.recipient_code,
        account_name: name,
        bank_account_number: accountNumber,
        bank_code: bankCode
      })
      .eq('id', brandId);

    return NextResponse.json({ success: true, recipient_code: recipient.recipient_code });

  } catch (error: any) {
    console.error('[RECIPIENT_ERROR]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

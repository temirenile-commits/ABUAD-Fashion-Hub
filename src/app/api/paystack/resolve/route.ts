import { NextResponse } from 'next/server';
import { resolveAccountNumber } from '@/lib/paystack';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const accountNumber = searchParams.get('accountNumber');
  const bankCode = searchParams.get('bankCode');

  if (!accountNumber || !bankCode) {
    return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
  }

  try {
    const account = await resolveAccountNumber(accountNumber, bankCode);
    return NextResponse.json({ success: true, data: account });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

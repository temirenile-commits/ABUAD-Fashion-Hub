import { NextResponse } from 'next/server';
import { listBanks } from '@/lib/paystack';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const banks = await listBanks();
    return NextResponse.json({ success: true, data: banks });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

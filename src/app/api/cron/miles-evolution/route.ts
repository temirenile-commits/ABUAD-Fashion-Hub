import { NextResponse } from 'next/server';
import { evaluateNativeEvolution } from '@/lib/ai/native-intelligence';

export const maxDuration = 30;

function authorized(request: Request) {
  const configured = process.env.CRON_SECRET;
  if (!configured) return false;
  const header = request.headers.get('authorization');
  return header === `Bearer ${configured}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const result = await evaluateNativeEvolution();
    return NextResponse.json({ ok: true, result });
  } catch {
    return NextResponse.json({ error: 'Evolution evaluation failed.' }, { status: 500 });
  }
}

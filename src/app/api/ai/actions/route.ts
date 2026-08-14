import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server-auth';
import { confirmMilesAction, MilesActionError, proposeMilesAction } from '@/lib/ai/actions';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  try {
    const body = await req.json();
    if (body?.mode === 'propose') {
      const proposal = await proposeMilesAction(user.id, body.actionType, body.payload);
      return NextResponse.json({ proposal });
    }
    if (body?.mode === 'confirm') {
      const result = await confirmMilesAction(user.id, String(body.actionId || ''), String(body.confirmation || ''));
      return NextResponse.json({ result });
    }
    throw new MilesActionError('INVALID_ACTION', 'Invalid Miles action request.');
  } catch (error) {
    if (error instanceof MilesActionError) {
      const status = error.code === 'NOT_ALLOWED' ? 403 : error.code === 'NOT_FOUND' ? 404 : error.code === 'CONFIRMATION_REQUIRED' ? 409 : error.code === 'EXPIRED' || error.code === 'ALREADY_USED' ? 410 : error.code === 'INVALID_ACTION' ? 400 : 502;
      return NextResponse.json({ error: error.message, code: `MILES_ACTION_${error.code}` }, { status });
    }
    console.error('[MILES_ACTION] Request failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Miles could not complete that request. Please try again.', code: 'MILES_ACTION_FAILED' }, { status: 502 });
  }
}

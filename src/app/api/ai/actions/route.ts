import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server-auth';
import { confirmMilesAction, MilesActionError, proposeMilesAction } from '@/lib/ai/actions';
import { confirmMilesAdminAction, MilesAdminActionError, proposeMilesAdminAction, type AdminActionType } from '@/lib/ai/admin-actions';

export const dynamic = 'force-dynamic';

function actionErrorResponse(error: unknown) {
  const code = error instanceof MilesActionError || error instanceof MilesAdminActionError ? error.code : 'ACTION_FAILED';
  const message = error instanceof Error ? error.message : 'Miles could not complete that request. Please try again.';
  const status = code === 'NOT_ALLOWED' ? 403 : code === 'NOT_FOUND' ? 404 : code === 'CONFIRMATION_REQUIRED' ? 409 : code === 'EXPIRED' || code === 'ALREADY_USED' ? 410 : code === 'INVALID_ACTION' ? 400 : 502;
  return NextResponse.json({ error: message, code: `MILES_ACTION_${code}` }, { status });
}

export async function POST(req: Request) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  try {
    const body = await req.json();
    const actionDomain = body?.domain === 'admin' ? 'admin' : 'vendor';
    if (actionDomain === 'admin') {
      if (body?.mode === 'propose') {
        const proposal = await proposeMilesAdminAction(user.id, body.actionType as AdminActionType, String(body.targetId || ''), body.payload || {});
        return NextResponse.json({ proposal, domain: 'admin' });
      }
      if (body?.mode === 'confirm') {
        const result = await confirmMilesAdminAction(user.id, String(body.actionId || ''), String(body.confirmation || ''));
        return NextResponse.json({ result });
      }
    } else {
      if (body?.mode === 'propose') {
        const proposal = await proposeMilesAction(user.id, body.actionType, body.payload);
        return NextResponse.json({ proposal, domain: 'vendor' });
      }
      if (body?.mode === 'confirm') {
        const result = await confirmMilesAction(user.id, String(body.actionId || ''), String(body.confirmation || ''));
        return NextResponse.json({ result });
      }
    }
    throw new MilesActionError('INVALID_ACTION', 'Invalid Miles action request.');
  } catch (error) {
    if (error instanceof MilesActionError || error instanceof MilesAdminActionError) return actionErrorResponse(error);
    console.error('[MILES_ACTION] Request failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ error: 'Miles could not complete that request. Please try again.', code: 'MILES_ACTION_FAILED' }, { status: 502 });
  }
}

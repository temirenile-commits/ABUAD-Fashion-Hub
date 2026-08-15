import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server-auth';
import { recordNativeFeedback } from '@/lib/ai/native-intelligence';

export async function POST(req: Request) {
  const user = await getAuthenticatedUser(req);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  try {
    const body = await req.json();
    await recordNativeFeedback({
      feedbackType: typeof body.feedbackType === 'string' ? body.feedbackType : 'failure',
      rating: typeof body.rating === 'number' ? body.rating : undefined,
      message: body.message,
      correction: body.correction,
      intent: body.intent,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Feedback could not be recorded.' }, { status: 400 });
  }
}

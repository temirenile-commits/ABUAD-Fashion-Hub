import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server-auth';
import { resolveMilesContext } from '@/lib/ai/role-context';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { recordNativeFeedback, sanitizeNativeText } from '@/lib/ai/native-intelligence';

const allowedStatuses = new Set(['proposed', 'validating', 'verified', 'active', 'deprecated']);

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const context = await resolveMilesContext(user.id, 'native knowledge review');
  if (!context?.isOverallSuperAdmin) return NextResponse.json({ error: 'Overall super administrator permission required.' }, { status: 403 });
  try {
    const body = await request.json();
    const id = typeof body.id === 'string' ? body.id : '';
    const status = typeof body.status === 'string' ? body.status : '';
    if (!id || !allowedStatuses.has(status)) return NextResponse.json({ error: 'A valid knowledge id and status are required.' }, { status: 400 });
    const update = { status, approved_by: ['verified', 'active'].includes(status) ? user.id : null, approved_at: ['verified', 'active'].includes(status) ? new Date().toISOString() : null, last_verified_at: ['verified', 'active'].includes(status) ? new Date().toISOString() : null };
    const { data, error } = await supabaseAdmin.from('miles_native_knowledge').update(update).eq('id', id).select('id,status,version,last_verified_at').limit(1).maybeSingle();
    if (error || !data) return NextResponse.json({ error: 'Knowledge record could not be reviewed.' }, { status: 404 });
    await recordNativeFeedback({ feedbackType: 'admin_correction', correction: `Knowledge record ${sanitizeNativeText(id, 80)} moved to ${status}.`, intent: 'knowledge_review' });
    return NextResponse.json({ ok: true, knowledge: data });
  } catch {
    return NextResponse.json({ error: 'Knowledge review failed.' }, { status: 400 });
  }
}

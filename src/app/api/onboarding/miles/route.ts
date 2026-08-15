import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { resolveMilesContext } from '@/lib/ai/role-context';
import { MILES_ONBOARDING_VERSION } from '@/lib/miles/onboarding';

const ALLOWED_FIELDS = ['roleKey', 'onboardingVersion', 'onboardingStarted', 'currentStep', 'completed', 'skipped'] as const;
type ProgressBody = Partial<Record<(typeof ALLOWED_FIELDS)[number], unknown>>;

function normalizeProgress(body: ProgressBody) {
  return {
    onboarding_version: typeof body.onboardingVersion === 'number' ? Math.max(1, Math.floor(body.onboardingVersion)) : MILES_ONBOARDING_VERSION,
    onboarding_started: typeof body.onboardingStarted === 'boolean' ? body.onboardingStarted : undefined,
    current_step: typeof body.currentStep === 'number' ? Math.max(0, Math.floor(body.currentStep)) : undefined,
    completed: typeof body.completed === 'boolean' ? body.completed : undefined,
    skipped: typeof body.skipped === 'boolean' ? body.skipped : undefined,
  };
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ authenticated: false, mode: 'public', onboardingVersion: MILES_ONBOARDING_VERSION });

  const [context, progressResult] = await Promise.all([
    resolveMilesContext(user.id, 'The user is viewing the MasterCart onboarding guide.'),
    supabaseAdmin.from('miles_onboarding_progress').select('role_key, onboarding_version, onboarding_started, current_step, completed, skipped, last_seen').eq('user_id', user.id).maybeSingle(),
  ]);
  if (progressResult.error && !progressResult.error.message.toLowerCase().includes('does not exist')) {
    return NextResponse.json({ error: 'Onboarding state unavailable.' }, { status: 500 });
  }
  return NextResponse.json({
    authenticated: true,
    mode: 'authenticated',
    role: context?.role || 'customer',
    roles: context?.roles || ['customer'],
    capabilities: context?.capabilities || [],
    permissions: context?.permissions || [],
    onboardingVersion: MILES_ONBOARDING_VERSION,
    progress: progressResult.data || null,
  });
}

export async function PATCH(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });

  let body: ProgressBody;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid onboarding payload.' }, { status: 400 }); }
  const context = await resolveMilesContext(user.id, 'The user is updating Miles onboarding progress.');
  const normalized = normalizeProgress(body);
  const update = {
    user_id: user.id,
    role_key: typeof body.roleKey === 'string' && body.roleKey.length < 80 ? body.roleKey : context?.role || 'customer',
    onboarding_version: normalized.onboarding_version,
    onboarding_started: normalized.onboarding_started ?? true,
    current_step: normalized.current_step ?? 0,
    completed: normalized.completed ?? false,
    skipped: normalized.skipped ?? false,
    last_seen: new Date().toISOString(),
  };
  const result = await supabaseAdmin.from('miles_onboarding_progress').upsert(update, { onConflict: 'user_id' }).select('role_key, onboarding_version, onboarding_started, current_step, completed, skipped, last_seen').single();
  if (result.error) return NextResponse.json({ error: 'Onboarding state could not be saved.' }, { status: 500 });
  return NextResponse.json({ ok: true, progress: result.data });
}

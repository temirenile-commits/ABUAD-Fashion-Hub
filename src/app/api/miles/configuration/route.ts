import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/server-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { resolveMilesConfiguration, sanitizeMilesName } from '@/lib/ai/miles-configuration';
import { resolveMilesContext } from '@/lib/ai/role-context';

type ScopeType = 'GLOBAL' | 'UNIVERSITY' | 'ROLE' | 'USER';
const HIGH_RISK_KEYS = new Set(['provider', 'providers', 'fallback', 'model', 'safety']);

function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function cleanConfig(value: unknown, isOverallSuperAdmin: boolean) {
  if (!isRecord(value)) return {};
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!isOverallSuperAdmin && HIGH_RISK_KEYS.has(key.toLowerCase())) continue;
    if (key === 'identity' && isRecord(item)) result.identity = { ...item, name: sanitizeMilesName(item.name) };
    else result[key] = item;
  }
  return result;
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const context = await resolveMilesContext(user.id, 'The user is viewing Miles configuration.');
  if (!context) return NextResponse.json({ error: 'Miles context unavailable.' }, { status: 500 });
  const effective = await resolveMilesConfiguration(user.id, 'The user is viewing Miles configuration.');
  const includeScopes = context.isOverallSuperAdmin || context.roles.some((role) => role === 'university_admin' || role === 'university_staff');
  const scopes = includeScopes ? (await supabaseAdmin.from('miles_configurations').select('id, scope_type, user_id, university_id, role_key, config, updated_by, reason, updated_at').limit(200)).data || [] : [];
  const audit = context.isOverallSuperAdmin ? (await supabaseAdmin.from('miles_configuration_audit').select('id, actor_id, scope_type, user_id, university_id, role_key, setting_changed, old_value, new_value, reason, created_at').order('created_at', { ascending: false }).limit(100)).data || [] : [];
  return NextResponse.json({ effective, context: { role: context.role, roles: context.roles, permissions: context.permissions, capabilities: context.capabilities, isOverallSuperAdmin: context.isOverallSuperAdmin, universityIds: context.universityIds }, scopes, audit });
}

export async function PATCH(request: Request) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const context = await resolveMilesContext(user.id, 'The user is changing Miles configuration.');
  if (!context) return NextResponse.json({ error: 'Miles context unavailable.' }, { status: 500 });
  let body: { scopeType?: unknown; userId?: unknown; universityId?: unknown; roleKey?: unknown; config?: unknown; reason?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid configuration payload.' }, { status: 400 }); }
  const scopeType = body.scopeType as ScopeType;
  if (!['GLOBAL', 'UNIVERSITY', 'ROLE', 'USER'].includes(scopeType)) return NextResponse.json({ error: 'Invalid configuration scope.' }, { status: 400 });
  const targetUserId = typeof body.userId === 'string' ? body.userId : scopeType === 'USER' ? user.id : null;
  const universityId = typeof body.universityId === 'string' ? body.universityId : null;
  const roleKey = typeof body.roleKey === 'string' ? body.roleKey.slice(0, 80) : null;
  const canEditGlobal = context.isOverallSuperAdmin && scopeType === 'GLOBAL';
  const canEditUniversity = (context.isOverallSuperAdmin || context.roles.includes('university_admin') || context.roles.includes('university_staff')) && scopeType === 'UNIVERSITY' && Boolean(universityId && (context.isOverallSuperAdmin || context.universityIds?.includes(universityId)));
  const canEditRole = context.isOverallSuperAdmin && scopeType === 'ROLE';
  const canEditUser = scopeType === 'USER' && targetUserId === user.id;
  if (!(canEditGlobal || canEditUniversity || canEditRole || canEditUser)) return NextResponse.json({ error: 'You are not authorized to change this Miles scope.' }, { status: 403 });
  const config = cleanConfig(body.config, context.isOverallSuperAdmin);
  const selector: Record<string, string> = scopeType === 'GLOBAL' ? { scope_type: scopeType } : scopeType === 'UNIVERSITY' ? { scope_type: scopeType, university_id: universityId || '' } : scopeType === 'ROLE' ? { scope_type: scopeType, role_key: roleKey || '' } : { scope_type: scopeType, user_id: targetUserId || user.id };
  const existing = await supabaseAdmin.from('miles_configurations').select('id, config').match(selector).maybeSingle();
  if (existing.error) return NextResponse.json({ error: 'Configuration lookup failed.' }, { status: 500 });
  const mergedConfig = { ...(isRecord(existing.data?.config) ? existing.data.config : {}), ...config };
  const row = { ...selector, config: mergedConfig, updated_by: user.id, reason: typeof body.reason === 'string' ? body.reason.slice(0, 500) : null };
  const saved = existing.data?.id
    ? await supabaseAdmin.from('miles_configurations').update(row).eq('id', existing.data.id).select('id, scope_type, user_id, university_id, role_key, config, updated_at').single()
    : await supabaseAdmin.from('miles_configurations').insert(row).select('id, scope_type, user_id, university_id, role_key, config, updated_at').single();
  if (saved.error) return NextResponse.json({ error: 'Miles configuration could not be saved.' }, { status: 500 });
  await supabaseAdmin.from('miles_configuration_audit').insert({ actor_id: user.id, scope_type: scopeType, user_id: targetUserId, university_id: universityId, role_key: roleKey, setting_changed: Object.keys(config).join(',') || 'configuration', old_value: existing.data?.config || null, new_value: mergedConfig, reason: typeof body.reason === 'string' ? body.reason.slice(0, 500) : null });
  return NextResponse.json({ ok: true, configuration: saved.data, effective: await resolveMilesConfiguration(user.id) });
}

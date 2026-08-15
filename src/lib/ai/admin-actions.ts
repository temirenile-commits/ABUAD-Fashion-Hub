import crypto from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { resolveMilesContext, canUseMilesTool, type MilesContext } from '@/lib/ai/role-context';

export type AdminActionType = 'suspend_user' | 'restore_user' | 'verify_vendor' | 'suspend_vendor' | 'restore_vendor' | 'moderate_product' | 'moderate_reel';
type JsonRecord = Record<string, unknown>;
const TTL_MS = 5 * 60 * 1000;

export class MilesAdminActionError extends Error {
  constructor(public readonly code: 'INVALID_ACTION' | 'NOT_ALLOWED' | 'NOT_FOUND' | 'EXPIRED' | 'ALREADY_USED' | 'CONFIRMATION_REQUIRED' | 'ACTION_FAILED', message: string) {
    super(message);
    this.name = 'MilesAdminActionError';
  }
}

const REQUIREMENTS: Record<AdminActionType, string> = {
  suspend_user: 'user_management', restore_user: 'user_management', verify_vendor: 'vendor_verification', suspend_vendor: 'vendor_management', restore_vendor: 'vendor_management', moderate_product: 'marketplace_moderation', moderate_reel: 'reel_moderation',
};

export function detectMilesAdminActionRequest(message: string) {
  const text = message.trim();
  const patterns: Array<[AdminActionType, RegExp]> = [
    ['suspend_user', /(?:suspend|disable)\s+user\s+([0-9a-f-]{36})/i],
    ['restore_user', /(?:restore|reactivate)\s+user\s+([0-9a-f-]{36})/i],
    ['verify_vendor', /verify\s+vendor\s+([0-9a-f-]{36})/i],
    ['suspend_vendor', /(?:suspend|disable)\s+vendor\s+([0-9a-f-]{36})/i],
    ['restore_vendor', /(?:restore|reactivate)\s+vendor\s+([0-9a-f-]{36})/i],
    ['moderate_product', /moderate\s+product\s+([0-9a-f-]{36})/i],
    ['moderate_reel', /moderate\s+reel\s+([0-9a-f-]{36})/i],
  ];
  for (const [actionType, pattern] of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return { actionType, targetId: match[1] };
  }
  return null;
}

function record(value: unknown): value is JsonRecord { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (record(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function hash(value: unknown) { return crypto.createHash('sha256').update(canonicalize(value)).digest('hex'); }
function isHighRisk(actionType: AdminActionType) { return ['suspend_user', 'suspend_vendor'].includes(actionType); }

async function targetInfo(actionType: AdminActionType, targetId: string) {
  if (!targetId) throw new MilesAdminActionError('INVALID_ACTION', 'A target must be selected.');
  if (actionType === 'verify_vendor' || actionType === 'suspend_vendor' || actionType === 'restore_vendor') {
    const { data } = await supabaseAdmin.from('brands').select('id, name, owner_id, university_id, verified, verification_status').eq('id', targetId).maybeSingle();
    if (!data) throw new MilesAdminActionError('NOT_FOUND', 'That vendor could not be found.');
    return { resource: 'vendor', id: data.id, universityId: data.university_id, previous: data };
  }
  if (actionType === 'suspend_user' || actionType === 'restore_user') {
    const { data } = await supabaseAdmin.from('users').select('id, name, role, status, university_id').eq('id', targetId).maybeSingle();
    if (!data) throw new MilesAdminActionError('NOT_FOUND', 'That user could not be found.');
    return { resource: 'user', id: data.id, universityId: data.university_id, previous: data };
  }
  if (actionType === 'moderate_product') {
    const { data } = await supabaseAdmin.from('products').select('id, title, brand_id, locked, is_draft, university_id').eq('id', targetId).maybeSingle();
    if (!data) throw new MilesAdminActionError('NOT_FOUND', 'That product could not be found.');
    return { resource: 'product', id: data.id, universityId: data.university_id, previous: data };
  }
  const { data } = await supabaseAdmin.from('reels').select('id, title, brand_id, status, university_id').eq('id', targetId).maybeSingle();
  if (!data) throw new MilesAdminActionError('NOT_FOUND', 'That Reel could not be found.');
  return { resource: 'reel', id: data.id, universityId: data.university_id, previous: data };
}

function permitted(context: MilesContext, actionType: AdminActionType, universityId: string | null) {
  const requirement = REQUIREMENTS[actionType];
  if (!context.isFullAdmin && !canUseMilesTool(context, requirement, universityId)) return false;
  if (!context.isFullAdmin && context.roles.includes('customer_support_agent') && requirement !== 'user_management') return false;
  return context.roles.some((role) => ['super_admin', 'admin', 'sub_admin', 'university_admin', 'university_staff', 'customer_support_agent'].includes(role));
}

export async function proposeMilesAdminAction(userId: string, actionType: AdminActionType, targetId: string, payload: JsonRecord = {}) {
  if (!Object.prototype.hasOwnProperty.call(REQUIREMENTS, actionType)) throw new MilesAdminActionError('INVALID_ACTION', 'Miles cannot perform that administrative action.');
  const context = await resolveMilesContext(userId, 'Administrative action preview');
  if (!context || !context.roles.some((role) => ['super_admin', 'admin', 'sub_admin', 'university_admin', 'university_staff', 'customer_support_agent'].includes(role))) throw new MilesAdminActionError('NOT_ALLOWED', 'Your role cannot perform administrative actions through Miles.');
  const target = await targetInfo(actionType, targetId);
  if (!permitted(context, actionType, target.universityId)) throw new MilesAdminActionError('NOT_ALLOWED', 'You do not have permission or scope for that action.');
  const actionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + TTL_MS).toISOString();
  const actionPayload = { ...payload, targetName: (target.previous as any).name || (target.previous as any).title || null, highRisk: isHighRisk(actionType) };
  const { error } = await supabaseAdmin.from('miles_controlled_actions').insert({ action_id: actionId, actor_id: userId, actor_role: context.role, action_type: actionType, target_resource: target.resource, target_resource_id: target.id, permission_requirement: REQUIREMENTS[actionType], scope_requirement: target.universityId, confirmation_required: true, payload: actionPayload, previous_state: target.previous, request_hash: hash({ actionType, targetId, actionPayload }), expires_at: expiresAt });
  if (error) throw new MilesAdminActionError('ACTION_FAILED', 'Miles could not prepare that action.');
  console.info('[MILES_ACTION_PROPOSED]', { actionId, actorId: userId, actorRole: context.role, actionType, resource: target.resource, targetId });
  return { actionId, actionType, targetResource: target.resource, targetResourceId: target.id, summary: `I can ${actionType.replaceAll('_', ' ')} ${String(actionPayload.targetName || 'this resource')}. This action requires explicit confirmation.`, highRisk: isHighRisk(actionType), expiresAt, confirmationPhrase: 'CONFIRM ACTION' };
}

export async function confirmMilesAdminAction(userId: string, actionId: string, confirmation: string) {
  if (confirmation.trim().toUpperCase() !== 'CONFIRM ACTION') throw new MilesAdminActionError('CONFIRMATION_REQUIRED', 'Type CONFIRM ACTION to approve this exact administrative change.');
  const { data: action } = await supabaseAdmin.from('miles_controlled_actions').select('*').eq('action_id', actionId).eq('actor_id', userId).maybeSingle();
  if (!action) throw new MilesAdminActionError('NOT_FOUND', 'That action preview was not found.');
  if (action.confirmation_status !== 'pending' || action.execution_status !== 'pending') throw new MilesAdminActionError('ALREADY_USED', 'That action preview has already been used.');
  if (new Date(action.expires_at).getTime() <= Date.now()) {
    await supabaseAdmin.from('miles_controlled_actions').update({ confirmation_status: 'expired' }).eq('action_id', actionId).eq('confirmation_status', 'pending');
    throw new MilesAdminActionError('EXPIRED', 'The confirmation has expired. Please request the action again.');
  }
  const context = await resolveMilesContext(userId, 'Administrative action confirmation');
  if (!context) throw new MilesAdminActionError('NOT_ALLOWED', 'Your session could not be verified.');
  const target = await targetInfo(action.action_type as AdminActionType, action.target_resource_id);
  if (!permitted(context, action.action_type as AdminActionType, target.universityId)) throw new MilesAdminActionError('NOT_ALLOWED', 'Your current permission or scope does not allow this action.');
  const { data: claimed } = await supabaseAdmin.from('miles_controlled_actions').update({ confirmation_status: 'confirmed', confirmed_at: new Date().toISOString() }).eq('action_id', actionId).eq('actor_id', userId).eq('confirmation_status', 'pending').select('action_id').maybeSingle();
  if (!claimed) throw new MilesAdminActionError('ALREADY_USED', 'That action preview has already been used.');
  try {
    const result = await executeAdminAction(action.action_type as AdminActionType, action.target_resource_id, target.previous);
    await supabaseAdmin.from('miles_controlled_actions').update({ execution_status: 'executed', executed_at: new Date().toISOString(), resulting_state: result.state, result_summary: result.summary }).eq('action_id', actionId);
    console.info('[MILES_ACTION_EXECUTED]', { actionId, actorId: userId, actorRole: context.role, actionType: action.action_type, targetId: action.target_resource_id });
    return { actionId, summary: result.summary, status: 'executed', state: result.state };
  } catch (error) {
    await supabaseAdmin.from('miles_controlled_actions').update({ execution_status: 'failed', result_summary: 'The backend did not confirm the change.' }).eq('action_id', actionId);
    if (error instanceof MilesAdminActionError) throw error;
    throw new MilesAdminActionError('ACTION_FAILED', 'I could not complete that action. The system did not confirm the change.');
  }
}

async function executeAdminAction(actionType: AdminActionType, targetId: string, previous: any) {
  if (actionType === 'verify_vendor') {
    const { error, data } = await supabaseAdmin.from('brands').update({ verified: true, verification_status: 'approved' }).eq('id', targetId).select('id, name, verified, verification_status').single();
    if (error || !data) throw error || new Error('Vendor verification was not confirmed.');
    return { summary: `Vendor ${data.name} has been verified successfully.`, state: data };
  }
  if (actionType === 'suspend_vendor' || actionType === 'restore_vendor') {
    const next = actionType === 'suspend_vendor' ? { verified: false, verification_status: 'suspended' } : { verification_status: 'approved' };
    const { error, data } = await supabaseAdmin.from('brands').update(next).eq('id', targetId).select('id, name, verified, verification_status').single();
    if (error || !data) throw error || new Error('Vendor status was not confirmed.');
    return { summary: `Vendor ${data.name} was ${actionType === 'suspend_vendor' ? 'suspended' : 'restored'} successfully.`, state: data };
  }
  if (actionType === 'suspend_user' || actionType === 'restore_user') {
    const { error, data } = await supabaseAdmin.from('users').update({ status: actionType === 'suspend_user' ? 'suspended' : 'active' }).eq('id', targetId).select('id, name, role, status').single();
    if (error || !data) throw error || new Error('User status was not confirmed.');
    return { summary: `User ${data.name || data.id} was ${actionType === 'suspend_user' ? 'suspended' : 'restored'} successfully.`, state: data };
  }
  if (actionType === 'moderate_product') {
    const { error, data } = await supabaseAdmin.from('products').update({ locked: true, is_draft: true }).eq('id', targetId).select('id, title, locked, is_draft').single();
    if (error || !data) throw error || new Error('Product moderation was not confirmed.');
    return { summary: `Product ${data.title} was placed into moderation successfully.`, state: data };
  }
  const { error, data } = await supabaseAdmin.from('reels').update({ status: 'removed' }).eq('id', targetId).select('id, title, status').single();
  if (error || !data) throw error || new Error('Reel moderation was not confirmed.');
  return { summary: `Reel ${data.title || data.id} was removed from circulation successfully.`, state: data };
}

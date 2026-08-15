import { supabaseAdmin } from '@/lib/supabase-admin';
import { resolveMilesContext, type MilesContext } from '@/lib/ai/role-context';

export type MilesCapabilityPermission = { read: boolean; write: boolean };
export type MilesEffectiveConfiguration = {
  scope: { global: boolean; universityId: string | null; roles: string[]; userId: string };
  identity: { name: string; initial: string; avatar: string | null; displayName: string };
  permissions: { readEnabled: boolean; writeEnabled: boolean };
  assistance: { proactiveEnabled: boolean; notificationsEnabled: boolean; tourGuideEnabled: boolean };
  personality: Record<string, unknown>;
  capabilities: Record<string, MilesCapabilityPermission>;
  allowedTools: string[];
  safety: { confirmationRequiredForHighRisk: boolean; financialSourceOfTruth: 'mastercart_backend' };
  vendor?: { aiEnabled: boolean; autoReplyEnabled: boolean; customInstructions: string; storeAccessEnabled: boolean; storeWriteEnabled: boolean };
};

const DEFAULT_CONFIG = {
  identity: { name: 'Miles', personalizationAllowed: true, avatar: null },
  permissions: { readEnabled: true, writeEnabled: false },
  assistance: { proactiveEnabled: true, notificationsEnabled: true, tourGuideEnabled: true },
  personality: {},
  capabilities: {
    products: { read: true, write: true }, orders: { read: true, write: false }, finance: { read: true, write: false }, payouts: { read: true, write: false },
    users: { read: false, write: false }, vendors: { read: true, write: false }, support: { read: true, write: false }, analytics: { read: true, write: false }, university: { read: false, write: false },
  },
  safety: { confirmationRequiredForHighRisk: true, financialSourceOfTruth: 'mastercart_backend' as const },
  vendor: { aiEnabled: true, autoReplyEnabled: false, customInstructions: '', storeAccessEnabled: false, storeWriteEnabled: false },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function deepMerge<T extends Record<string, unknown>>(base: T, patch: unknown): T {
  if (!isRecord(patch)) return base;
  const next: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (isRecord(next[key]) && isRecord(value)) next[key] = deepMerge(next[key] as Record<string, unknown>, value);
    else next[key] = value;
  }
  return next as T;
}
function safeName(value: unknown, fallback = 'Miles') {
  if (typeof value !== 'string') return fallback;
  const normalized = value.normalize('NFKC').replace(/[<>]/g, '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 40);
  return normalized || fallback;
}
function initialFor(name: string) {
  return Array.from(name.trim())[0]?.toUpperCase() || 'M';
}
function canRead(context: MilesContext, permission: MilesCapabilityPermission | undefined) {
  return Boolean(context && (context.isFullAdmin || permission?.read));
}

export async function resolveMilesConfiguration(userId: string, pageContext?: string): Promise<MilesEffectiveConfiguration | null> {
  const context = await resolveMilesContext(userId, pageContext || 'The user is using MasterCart.');
  if (!context) return null;
  const [configs, legacyVendor] = await Promise.all([
    supabaseAdmin.from('miles_configurations').select('scope_type, user_id, university_id, role_key, config').limit(200),
    context.brandIds.length ? supabaseAdmin.from('vendor_ai_settings').select('ai_enabled, auto_reply_enabled, assistant_name, custom_instructions, store_access_enabled, store_write_enabled').eq('brand_id', context.brandIds[0]).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const legacy = legacyVendor.data ? { identity: { name: legacyVendor.data.assistant_name }, vendor: { aiEnabled: legacyVendor.data.ai_enabled !== false, autoReplyEnabled: legacyVendor.data.auto_reply_enabled === true, customInstructions: legacyVendor.data.custom_instructions || '', storeAccessEnabled: legacyVendor.data.store_access_enabled === true, storeWriteEnabled: legacyVendor.data.store_write_enabled === true } } : {};
  const rows = (configs.data || []).filter((row) => row.scope_type === 'GLOBAL' || (row.scope_type === 'USER' && row.user_id === userId) || (row.scope_type === 'UNIVERSITY' && Boolean(row.university_id && context.universityIds?.includes(row.university_id))) || (row.scope_type === 'ROLE' && Boolean(row.role_key && context.roles.includes(row.role_key))));
  const global = rows.find((row) => row.scope_type === 'GLOBAL')?.config || {};
  let merged = deepMerge(deepMerge(DEFAULT_CONFIG, legacy), global);
  for (const universityId of context.universityIds || []) {
    const row = rows.find((item) => item.scope_type === 'UNIVERSITY' && item.university_id === universityId);
    if (row) merged = deepMerge(merged, row.config);
  }
  for (const role of context.roles) {
    const row = rows.find((item) => item.scope_type === 'ROLE' && item.role_key === role);
    if (row) merged = deepMerge(merged, row.config);
  }
  const personal = rows.find((row) => row.scope_type === 'USER' && row.user_id === userId)?.config;
  if (personal) merged = deepMerge(merged, personal);

  const identity = (isRecord(merged.identity) ? merged.identity : {}) as Record<string, unknown>;
  const name = safeName(identity.name);
  const capabilities = (isRecord(merged.capabilities) ? merged.capabilities : {}) as Record<string, unknown>;
  const normalizedCapabilities = Object.fromEntries(Object.entries(capabilities).map(([key, value]) => [key, {
    read: Boolean(isRecord(value) && value.read) && (context.isFullAdmin || Boolean((value as Record<string, unknown>).read)),
    write: Boolean(isRecord(value) && value.write) && (context.isFullAdmin || Boolean((value as Record<string, unknown>).write)),
  }]));
  const permissionConfig = (isRecord(merged.permissions) ? merged.permissions : {}) as Record<string, unknown>;
  const assistance = (isRecord(merged.assistance) ? merged.assistance : {}) as Record<string, unknown>;
  const safety = (isRecord(merged.safety) ? merged.safety : {}) as Record<string, unknown>;
  const vendor = (isRecord(merged.vendor) ? merged.vendor : {}) as Record<string, unknown>;
  const allowedTools = Object.entries(normalizedCapabilities).filter(([, value]) => value.read || value.write).map(([key]) => key);
  return {
    scope: { global: context.isFullAdmin, universityId: context.universityIds?.[0] || null, roles: context.roles, userId },
    identity: { name, initial: initialFor(name), avatar: typeof identity.avatar === 'string' ? identity.avatar : null, displayName: name },
    permissions: { readEnabled: context.isFullAdmin || permissionConfig.readEnabled !== false, writeEnabled: context.isFullAdmin || permissionConfig.writeEnabled === true },
    assistance: { proactiveEnabled: assistance.proactiveEnabled !== false, notificationsEnabled: assistance.notificationsEnabled !== false, tourGuideEnabled: assistance.tourGuideEnabled !== false },
    personality: isRecord(merged.personality) ? merged.personality : {},
    capabilities: normalizedCapabilities,
    allowedTools,
    safety: { confirmationRequiredForHighRisk: safety.confirmationRequiredForHighRisk !== false, financialSourceOfTruth: 'mastercart_backend' },
    vendor: { aiEnabled: vendor.aiEnabled !== false, autoReplyEnabled: vendor.autoReplyEnabled === true, customInstructions: typeof vendor.customInstructions === 'string' ? vendor.customInstructions.slice(0, 2000) : '', storeAccessEnabled: vendor.storeAccessEnabled === true, storeWriteEnabled: vendor.storeWriteEnabled === true },
  };
}

export function canMilesRead(configuration: MilesEffectiveConfiguration, category: string) {
  return configuration.permissions.readEnabled && canRead({} as MilesContext, configuration.capabilities[category]);
}
export function canMilesWrite(configuration: MilesEffectiveConfiguration, category: string) {
  return configuration.permissions.writeEnabled && Boolean(configuration.capabilities[category]?.write);
}
export function sanitizeMilesName(value: unknown) {
  return safeName(value);
}

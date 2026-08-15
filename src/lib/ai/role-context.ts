import { supabaseAdmin } from '@/lib/supabase-admin';
import type { UserRole } from '@/lib/rbac';

export type MilesCapability = string;

export type MilesScope = {
  kind: 'user' | 'vendor' | 'university' | 'platform';
  userId: string;
  universityIds: string[] | null;
  brandIds: string[];
};

export type MilesContext = {
  userId: string;
  email: string;
  /** Backward-compatible primary role. Use roles/capabilities for authorization decisions. */
  role: UserRole;
  roles: UserRole[];
  permissions: string[];
  capabilities: MilesCapability[];
  universityIds: string[] | null;
  brandIds: string[];
  isFullAdmin: boolean;
  /** Only the designated overall super administrator may receive highly sensitive operational context. */
  isOverallSuperAdmin: boolean;
  scope: MilesScope;
  pageContext: string;
};

const ADMIN_ROLES = new Set<UserRole>(['super_admin', 'admin', 'sub_admin', 'university_admin', 'university_staff', 'customer_support_agent']);
const PLATFORM_ROLES = new Set<UserRole>(['super_admin', 'admin']);
const VENDOR_ROLES = new Set<UserRole>(['vendor']);
const KNOWN_ROLES = new Set<UserRole>(['super_admin', 'admin', 'sub_admin', 'university_admin', 'university_staff', 'customer_support_agent', 'vendor', 'customer', 'rider', 'delivery']);
const ROLE_PRIORITY: UserRole[] = ['super_admin', 'admin', 'sub_admin', 'university_admin', 'university_staff', 'customer_support_agent', 'vendor', 'customer', 'rider', 'delivery'];

const BASE_CAPABILITIES = [
  'marketplace_guidance', 'product_discovery', 'search_guidance', 'customer_orders', 'account_guidance',
  'cart_guidance', 'customer_support_guidance', 'returns_guidance', 'delivery_guidance', 'marketplace_explanations',
  'navigation_assistance', 'product_questions', 'reels_guidance', 'customer_interaction_guidance',
  'platform_faq', 'personalized_assistance',
] as const;

const VENDOR_CAPABILITIES = [
  'vendor_products', 'vendor_product_performance', 'vendor_inventory', 'vendor_product_editing',
  'vendor_listing_guidance', 'vendor_orders', 'vendor_order_prioritization', 'vendor_reels',
  'vendor_reel_analytics', 'vendor_analytics', 'vendor_financial_summary', 'vendor_wallet',
] as const;

const ADMIN_CAPABILITIES = [
  'admin_analytics', 'marketplace_monitoring', 'user_management_guidance', 'vendor_management',
  'platform_trends', 'operational_monitoring', 'rankings', 'charts', 'platform_intelligence',
] as const;

const UNIVERSITY_ADMIN_CAPABILITIES = ['university_analytics', 'university_statistics', 'university_scope_monitoring'] as const;
const SUPPORT_CAPABILITIES = ['support_cases', 'customer_support_operations'] as const;

function normalizePermissions(values: unknown[]): string[] {
  return [...new Set(values.flatMap((value) => {
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
    return [];
  }))];
}

function normalizeRoles(values: unknown[]): UserRole[] {
  return [...new Set(values.flatMap((value) => {
    const candidates = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
    return candidates.map((item) => String(item).trim().toLowerCase()).filter((item): item is UserRole => KNOWN_ROLES.has(item as UserRole));
  }))];
}

function includesPermission(permissions: string[], expected: string) {
  const normalized = expected.toLowerCase();
  return permissions.some((item) => item.toLowerCase() === normalized || item.toLowerCase() === '*');
}

function hasAnyRole(roles: UserRole[], candidates: Set<UserRole>) {
  return roles.some((role) => candidates.has(role));
}

export function hasPlatformReadPermission(context: MilesContext) {
  return context.isFullAdmin || includesPermission(context.permissions, 'platform_read') || includesPermission(context.permissions, 'platform_analytics') || includesPermission(context.permissions, '*');
}

export function canUseMilesTool(context: MilesContext, permission?: string, universityId?: string | null) {
  if (permission && !context.isFullAdmin && !includesPermission(context.permissions, permission)) return false;
  if (!universityId || context.universityIds === null) return true;
  return context.universityIds.includes(universityId);
}

export function resolveMilesCapabilities(roles: UserRole[], permissions: string[], brandIds: string[]) {
  const capabilities = new Set<string>(BASE_CAPABILITIES);
  if (hasAnyRole(roles, VENDOR_ROLES) || brandIds.length > 0) VENDOR_CAPABILITIES.forEach((capability) => capabilities.add(capability));
  if (hasAnyRole(roles, ADMIN_ROLES)) ADMIN_CAPABILITIES.forEach((capability) => capabilities.add(capability));
  if (roles.some((role) => role === 'university_admin' || role === 'university_staff')) UNIVERSITY_ADMIN_CAPABILITIES.forEach((capability) => capabilities.add(capability));
  if (roles.includes('customer_support_agent') || includesPermission(permissions, 'support') || includesPermission(permissions, 'support_cases')) SUPPORT_CAPABILITIES.forEach((capability) => capabilities.add(capability));
  permissions.filter((permission) => permission && permission !== '*').forEach((permission) => capabilities.add(`permission:${permission}`));
  return [...capabilities];
}

export async function resolveMilesContext(userId: string, pageContext = 'The user is viewing the MasterCart marketplace.'): Promise<MilesContext | null> {
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, email, role, university_id, admin_permissions')
    .eq('id', userId)
    .maybeSingle();
  if (error || !user) return null;

  const teamResult = await supabaseAdmin
    .from('university_teams')
    .select('university_id, permissions, role')
    .or(`member_id.eq.${userId},admin_id.eq.${userId}`)
    .limit(50);
  const teams = teamResult.data || [];
  const teamRoles = normalizeRoles(teams.map((team) => team.role || ''));
  const roles = normalizeRoles([user.role || 'customer', ...teamRoles]);
  if (!roles.includes('customer')) roles.push('customer');

  const permissions = normalizePermissions([
    user.admin_permissions || [],
    ...teams.map((team) => team.permissions || []),
  ]);
  const isFullAdmin = roles.some((role) => PLATFORM_ROLES.has(role));
  // `admin` is retained as a legacy platform role, but only the canonical
  // `super_admin` role is allowed to receive highly sensitive platform context.
  const isOverallSuperAdmin = roles.includes('super_admin');
  const teamUniversityIds = teams.map((team) => team.university_id).filter(Boolean) as string[];
  const universityIds: string[] | null = isFullAdmin ? null : [...new Set([user.university_id, ...teamUniversityIds].filter(Boolean) as string[])];

  const { data: brands } = await supabaseAdmin.from('brands').select('id').eq('owner_id', userId).limit(20);
  const brandIds = (brands || []).map((brand) => brand.id);
  const capabilities = resolveMilesCapabilities(roles, permissions, brandIds);
  const primaryRole = ROLE_PRIORITY.find((candidate) => roles.includes(candidate)) || 'customer';
  const scopeKind: MilesScope['kind'] = isFullAdmin ? 'platform' : brandIds.length > 0 ? 'vendor' : universityIds?.length ? 'university' : 'user';

  return {
    userId,
    email: user.email || '',
    role: primaryRole,
    roles,
    permissions,
    capabilities,
    universityIds,
    brandIds,
    isFullAdmin,
    isOverallSuperAdmin,
    scope: { kind: scopeKind, userId, universityIds, brandIds },
    pageContext,
  };
}

export function scopeFilter<T extends { university_id?: string | null }>(rows: T[], context: MilesContext) {
  if (context.universityIds === null) return rows;
  if (!context.universityIds.length) return rows.filter((row) => !row.university_id);
  const universityIds = context.universityIds;
  return rows.filter((row) => !row.university_id || Boolean(universityIds?.includes(row.university_id)));
}

export function isAdministrativeRole(context: MilesContext | UserRole) {
  const roles = typeof context === 'string' ? [context] : context.roles;
  return roles.some((role) => ADMIN_ROLES.has(role));
}

export function isSupportRole(context: MilesContext) {
  return context.isFullAdmin || context.roles.includes('customer_support_agent') || includesPermission(context.permissions, 'support') || includesPermission(context.permissions, 'support_cases');
}

export function isVendorManagementRole(context: MilesContext) {
  return context.isFullAdmin || context.roles.includes('university_admin') || includesPermission(context.permissions, 'vendor_management') || includesPermission(context.permissions, 'vendor_verification');
}

export function isFinanceRole(context: MilesContext) {
  return context.isFullAdmin || includesPermission(context.permissions, 'finance') || includesPermission(context.permissions, 'payouts');
}

import { supabaseAdmin } from '@/lib/supabase-admin';
import type { UserRole } from '@/lib/rbac';

export type MilesScope = {
  kind: 'user' | 'vendor' | 'university' | 'platform';
  userId: string;
  universityIds: string[] | null;
  brandIds: string[];
};

export type MilesContext = {
  userId: string;
  email: string;
  role: UserRole;
  permissions: string[];
  universityIds: string[] | null;
  brandIds: string[];
  isFullAdmin: boolean;
  scope: MilesScope;
  pageContext: string;
};

const FULL_ADMIN_ROLES: UserRole[] = ['super_admin', 'admin'];
const PLATFORM_ROLES: UserRole[] = ['super_admin', 'admin'];

function normalizePermissions(values: unknown[]): string[] {
  return [...new Set(values.flatMap((value) => {
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
    return [];
  }))];
}

function includesPermission(permissions: string[], expected: string) {
  const normalized = expected.toLowerCase();
  return permissions.some((item) => item.toLowerCase() === normalized || item.toLowerCase() === '*');
}

export function hasPlatformReadPermission(context: MilesContext) {
  return context.isFullAdmin || includesPermission(context.permissions, 'platform_read') || includesPermission(context.permissions, 'platform_analytics') || includesPermission(context.permissions, '*');
}

export function canUseMilesTool(context: MilesContext, permission?: string, universityId?: string | null) {
  if (!permission && !universityId) return true;
  if (permission && !context.isFullAdmin && !includesPermission(context.permissions, permission)) return false;
  if (!universityId || context.universityIds === null) return true;
  return context.universityIds.includes(universityId);
}

export async function resolveMilesContext(userId: string, pageContext = 'The user is viewing the MasterCart marketplace.') : Promise<MilesContext | null> {
  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, email, role, university_id, admin_permissions')
    .eq('id', userId)
    .maybeSingle();
  if (error || !user) return null;

  const role = user.role as UserRole;
  const isFullAdmin = FULL_ADMIN_ROLES.includes(role);
  const teamResult = await supabaseAdmin
    .from('university_teams')
    .select('university_id, permissions, role')
    .or(`member_id.eq.${userId},admin_id.eq.${userId}`)
    .limit(50);

  const teams = teamResult.data || [];
  const teamUniversityIds = teams.map((team) => team.university_id).filter(Boolean) as string[];
  const universityIds: string[] | null = isFullAdmin
    ? null
    : [...new Set([user.university_id, ...teamUniversityIds].filter(Boolean) as string[])];
  const permissions = normalizePermissions([
    user.admin_permissions || [],
    ...teams.map((team) => team.permissions || []),
    ...teams.map((team) => team.role || ''),
  ]);

  const { data: brands } = await supabaseAdmin
    .from('brands')
    .select('id')
    .eq('owner_id', userId)
    .limit(20);

  const brandIds = (brands || []).map((brand) => brand.id);
  const scopeKind: MilesScope['kind'] = role === 'vendor'
    ? 'vendor'
    : isFullAdmin || PLATFORM_ROLES.includes(role)
      ? 'platform'
      : (universityIds?.length || 0) > 0
        ? 'university'
        : 'user';

  return {
    userId,
    email: user.email || '',
    role,
    permissions,
    universityIds,
    brandIds,
    isFullAdmin,
    scope: { kind: scopeKind, userId, universityIds, brandIds },
    pageContext,
  };
}

export function scopeFilter<T extends { university_id?: string | null }>(rows: T[], context: MilesContext) {
  if (context.universityIds === null) return rows;
  if (!context.universityIds.length) return rows.filter((row) => !row.university_id);
  return rows.filter((row) => !row.university_id || context.universityIds!.includes(row.university_id));
}

export function isAdministrativeRole(role: UserRole) {
  return ['super_admin', 'admin', 'sub_admin', 'university_admin', 'university_staff', 'customer_support_agent'].includes(role);
}

export function isSupportRole(context: MilesContext) {
  return context.isFullAdmin || context.role === 'customer_support_agent' || includesPermission(context.permissions, 'support') || includesPermission(context.permissions, 'support_cases');
}

export function isVendorManagementRole(context: MilesContext) {
  return context.isFullAdmin || context.role === 'university_admin' || includesPermission(context.permissions, 'vendor_management') || includesPermission(context.permissions, 'vendor_verification');
}

export function isFinanceRole(context: MilesContext) {
  return context.isFullAdmin || includesPermission(context.permissions, 'finance') || includesPermission(context.permissions, 'payouts');
}

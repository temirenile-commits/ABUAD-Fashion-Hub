import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export type UserRole =
  | 'super_admin'
  | 'admin'        // legacy alias for super_admin
  | 'sub_admin'    // legacy alias for admin-with-permissions
  | 'university_admin'
  | 'university_staff'
  | 'vendor'
  | 'customer'
  | 'rider'
  | 'delivery';    // legacy alias for rider

export interface AuthContext {
  userId: string;
  email: string;
  role: UserRole;
  universityId: string | null;
  isFullAdmin: boolean;
  permissions: string[];
}

// ─── Decode JWT without network call ────────────────────────
function decodeJwt(token: string): { sub?: string; email?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

// ─── Extract Bearer token from request ──────────────────────
function extractToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

// ─── Core: Get auth context from request ────────────────────
export async function getAuthContext(req: NextRequest): Promise<AuthContext | null> {
  const token = extractToken(req);
  if (!token) return null;

  const payload = decodeJwt(token);
  if (!payload?.sub) return null;

  const { data: profile, error } = await supabaseAdmin
    .from('users')
    .select('role, university_id, admin_permissions')
    .eq('id', payload.sub)
    .single();

  if (error || !profile) return null;

  const role = profile.role as UserRole;
  const isFullAdmin = role === 'admin' || role === 'super_admin';

  return {
    userId: payload.sub,
    email: payload.email || '',
    role,
    universityId: profile.university_id || null,
    isFullAdmin,
    permissions: profile.admin_permissions || [],
  };
}

// ─── Require specific roles (throws 401/403 response) ───────
export async function requireRole(
  req: NextRequest,
  allowedRoles: UserRole[]
): Promise<AuthContext> {
  const ctx = await getAuthContext(req);
  if (!ctx) {
    throw NextResponse.json({ error: 'Unauthorized: No valid session.' }, { status: 401 });
  }

  const normalizedRole = ctx.role;
  const isAllowed =
    allowedRoles.includes(normalizedRole) ||
    // admin / super_admin are always allowed everywhere
    ctx.isFullAdmin;

  if (!isAllowed) {
    throw NextResponse.json(
      { error: `Forbidden: Role '${ctx.role}' cannot perform this action.` },
      { status: 403 }
    );
  }

  return ctx;
}

// ─── Require super admin (admin or super_admin role) ─────────
export async function requireSuperAdmin(req: NextRequest): Promise<AuthContext> {
  return requireRole(req, ['super_admin', 'admin']);
}

// ─── Require university admin/staff (scoped to their university) ─
export async function requireUniversityAdmin(req: NextRequest): Promise<AuthContext> {
  return requireRole(req, ['university_admin', 'university_staff', 'super_admin', 'admin']);
}

// ─── Enforce university data scoping ────────────────────────
// Call this after requireUniversityAdmin() to get the enforced university_id
export function getUniversityScope(ctx: AuthContext, queryUniversityId?: string | null): string {
  // Super admins can query any university by passing university_id
  if (ctx.isFullAdmin && queryUniversityId) {
    return queryUniversityId;
  }
  // University admins are always scoped to their own university
  if (!ctx.isFullAdmin) {
    if (!ctx.universityId) {
      throw NextResponse.json(
        { error: 'Forbidden: Your account is not assigned to a university.' },
        { status: 403 }
      );
    }
    return ctx.universityId;
  }
  // Super admin without a filter — return their own university_id or empty string
  return ctx.universityId || '';
}

// ─── Check if user can perform university-specific write actions ─
export function canWriteToUniversity(ctx: AuthContext, targetUniversityId: string): boolean {
  if (ctx.isFullAdmin) return true;
  return ctx.universityId === targetUniversityId;
}

// ─── Product visibility filter for marketplace queries ───────
// Returns a Supabase filter condition based on viewer's university
export function getProductVisibilityFilter(customerUniversityId: string | null) {
  if (!customerUniversityId) {
    // Anonymous / no university — only global products
    return { visibility_type: 'global' as const };
  }
  // Authenticated: global OR same university
  return null; // Caller handles the OR condition with .or()
}

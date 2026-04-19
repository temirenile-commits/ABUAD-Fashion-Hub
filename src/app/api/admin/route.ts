import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// ─── Middleware: Verify request is from an admin ───────────────────────────
async function verifyAdmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  return profile?.role === 'admin' ? user : null;
}

// ─── GET Handler ───────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');

  // For development/internal use, we allow a secret key bypass
  const secret = req.headers.get('x-admin-secret');
  const isSecretValid = secret === process.env.ADMIN_SECRET_KEY;

  if (!isSecretValid) {
    const admin = await verifyAdmin(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (action === 'users') {
    // Pull all users from Supabase auth.users (gold source of truth)
    const { data: { users: authUsers }, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Pull profiles from public.users
    const { data: profiles } = await supabaseAdmin.from('users').select('*');
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

    // Merge auth + profile data
    const merged = (authUsers || []).map((u) => {
      const profile = profileMap.get(u.id) || {};
      return {
        id: u.id,
        email: u.email,
        name: (profile as any).name || u.user_metadata?.name || 'Unknown',
        role: (profile as any).role || u.user_metadata?.role || 'customer',
        phone: (profile as any).phone || null,
        created_at: u.created_at,
        last_sign_in: u.last_sign_in_at,
        confirmed: !!u.email_confirmed_at,
      };
    });

    return NextResponse.json({ users: merged });
  }

  if (action === 'vendors') {
    const { data, error } = await supabaseAdmin
      .from('brands')
      .select('*, users:owner_id(name, email)')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ vendors: data });
  }

  if (action === 'products') {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('*, brands(name, logo_url)')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ products: data });
  }

  if (action === 'stats') {
    const [
      { count: userCount },
      { count: brandCount },
      { count: productCount },
      { data: revenueData }
    ] = await Promise.all([
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('brands').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('products').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('orders').select('total_amount').eq('status', 'paid'),
    ]);

    const totalRevenue = (revenueData || []).reduce((sum: number, o: any) => sum + Number(o.total_amount), 0);

    return NextResponse.json({
      stats: { userCount, brandCount, productCount, totalRevenue }
    });
  }

  if (action === 'transactions') {
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('*, brands(name), users:user_id(name, email)')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ transactions: data });
  }

  if (action === 'orders') {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('*, products(title), brands(name), users:customer_id(name, email)')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ orders: data });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

// ─── POST Handler ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  const isSecretValid = secret === process.env.ADMIN_SECRET_KEY;

  if (!isSecretValid) {
    const admin = await verifyAdmin(req);
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { action } = body;

  if (action === 'approve_vendor') {
    const { brandId } = body;
    const { error } = await supabaseAdmin
      .from('brands')
      .update({ verification_status: 'approved', verified: false })
      .eq('id', brandId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, message: 'Vendor approved. They will be prompted to pay activation fee.' });
  }

  if (action === 'reject_vendor') {
    const { brandId, reason } = body;
    const { error } = await supabaseAdmin
      .from('brands')
      .update({ verification_status: 'rejected', rejection_reason: reason || 'Application did not meet requirements.' })
      .eq('id', brandId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'mark_verified') {
    // Final verified status — after fee is paid
    const { brandId } = body;
    const { error } = await supabaseAdmin
      .from('brands')
      .update({ verification_status: 'verified', verified: true })
      .eq('id', brandId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'delete_product') {
    const { productId } = body;
    const { error } = await supabaseAdmin
      .from('products')
      .delete()
      .eq('id', productId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'delete_user') {
    const { userId } = body;
    // Delete from public.users first (cascade should handle brands, but we do it explicitly)
    await supabaseAdmin.from('users').delete().eq('id', userId);
    // Then delete from auth
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'feature_product') {
    const { productId, featured } = body;
    const { error } = await supabaseAdmin
      .from('products')
      .update({ is_featured: featured })
      .eq('id', productId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireUniversityAdmin, requireSuperAdmin, getUniversityScope } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

// â”€â”€â”€ GET Handler — Scoped data fetching â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function GET(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireUniversityAdmin(req);
  } catch (errRes) {
    return errRes as NextResponse;
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  const queryUnivId = searchParams.get('university_id');

  // University admins are always scoped to their own university
  // Super admins can pass ?university_id= to scope to any university
  let universityId: string;
  try {
    universityId = getUniversityScope(ctx, queryUnivId);
  } catch (errRes) {
    return errRes as NextResponse;
  }

  // â”€â”€ Stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (action === 'stats') {
    const [usersRes, vendorsRes, ordersRes, ridersRes, productsRes] = await Promise.all([
      supabaseAdmin.from('users').select('id', { count: 'exact', head: true })
        .eq('university_id', universityId),
      supabaseAdmin.from('brands').select('id', { count: 'exact', head: true })
        .eq('university_id', universityId),
      supabaseAdmin.from('orders').select('total_amount, status')
        .eq('university_id', universityId),
      supabaseAdmin.from('delivery_agents').select('id', { count: 'exact', head: true })
        .eq('university_id', universityId),
      supabaseAdmin.from('products')
        .select('id, title, sales_count, views_count')
        .eq('university_id', universityId)
        .order('sales_count', { ascending: false })
        .limit(5),
    ]);

    const orders = ordersRes.data || [];
    const paidOrders = orders.filter((o: any) => o.status === 'paid');
    const totalRevenue = paidOrders.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);

    return NextResponse.json({
      stats: {
        totalUsers: usersRes.count ?? 0,
        totalVendors: vendorsRes.count ?? 0,
        totalOrders: orders.length,
        paidOrders: paidOrders.length,
        totalRevenue, // read-only
        totalRiders: ridersRes.count ?? 0,
        popularProducts: productsRes.data || [],
      },
    });
  }

  // â”€â”€ Vendors in university â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (action === 'vendors') {
    const { data, error } = await supabaseAdmin
      .from('brands')
      .select('*, users!owner_id(name, email, phone)')
      .eq('university_id', universityId)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ vendors: data || [] });
  }

  // â”€â”€ Customers (users) in university â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (action === 'customers') {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, name, email, phone, role, status, created_at')
      .eq('university_id', universityId)
      .in('role', ['customer', 'vendor'])
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ customers: data || [] });
  }

  // â”€â”€ Orders in university â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (action === 'orders') {
    const { data, error } = await supabaseAdmin
      .from('orders')
      .select('*, products(title), brands(name), users:customer_id(name, email)')
      .eq('university_id', universityId)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ orders: data || [] });
  }

  // â”€â”€ Reviews in university â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (action === 'reviews') {
    const { data, error } = await supabaseAdmin
      .from('reviews')
      .select('*, users:user_id(name, email), products:product_id(title), brands:brand_id(name)')
      .eq('university_id', universityId)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ reviews: data || [] });
  }

  // â”€â”€ Riders in university â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (action === 'riders') {
    const { data, error } = await supabaseAdmin
      .from('delivery_agents')
      .select('*, users:id(name, email, phone)')
      .eq('university_id', universityId)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const transformed = (data || []).map((a: any) => ({
      ...a,
      name: a.users?.name || 'Rider',
      email: a.users?.email || 'N/A',
      phone: a.users?.phone || 'N/A',
    }));
    return NextResponse.json({ riders: transformed });
  }

  // â”€â”€ Analytics — trend data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (action === 'analytics') {
    const { data: ordersData } = await supabaseAdmin
      .from('orders')
      .select('created_at, total_amount, status')
      .eq('university_id', universityId)
      .order('created_at', { ascending: true });

    // Aggregate by date
    const aggregated = (ordersData || []).reduce((acc: any, curr: any) => {
      const date = new Date(curr.created_at).toLocaleDateString('en-NG', { day: '2-digit', month: 'short' });
      if (!acc[date]) acc[date] = { orders: 0, revenue: 0 };
      acc[date].orders += 1;
      if (curr.status === 'paid') acc[date].revenue += Number(curr.total_amount || 0);
      return acc;
    }, {});

    const chartData = Object.entries(aggregated).map(([time, val]: any) => ({
      time,
      orders: val.orders,
      revenue: val.revenue,
    }));

    return NextResponse.json({ chartData });
  }

  // â”€â”€ Cross-university insights (AGGREGATED ONLY — no raw data) â”€
  if (action === 'cross_university_insights') {
    // Only university admins+ can see this
    const { data, error } = await supabaseAdmin
      .from('university_analytics')
      .select('university_id, university_name, abbreviation, total_users, total_vendors, verified_vendors, total_products, total_orders, paid_orders, total_revenue');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // If user is university admin (not super admin), redact revenue for other universities
    const result = (data || []).map((row: any) => {
      if (!ctx.isFullAdmin && row.university_id !== universityId) {
        return {
          ...row,
          total_revenue: null, // REDACTED for non-super-admins
        };
      }
      return row;
    });

    return NextResponse.json({ insights: result });
  }

  // â”€â”€ Team members (staff) in this university â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (action === 'team') {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, name, email, role, admin_permissions, created_at')
      .eq('university_id', universityId)
      .in('role', ['university_admin', 'university_staff'])
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ team: data || [] });
  }

  // — Products (Catalog) in university ——————————————————————————————————————
  if (action === 'products') {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('*, brands(name)')
      .eq('university_id', universityId)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ products: data || [] });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

// ————————————————————————————————————————————————————
// — POST Handler — University-scoped admin actions —————————————————————
export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireUniversityAdmin(req);
  } catch (errRes) {
    return errRes as NextResponse;
  }

  const body = await req.json();
  const { action } = body;

  // Helper: enforce university scope on a target record
  const ensureScope = async (table: string, id: string, column = 'university_id') => {
    if (ctx.isFullAdmin) return true; // super admin skips check
    const { data } = await supabaseAdmin.from(table).select(column).eq('id', id).single();
    return (data as any)?.[column] === ctx.universityId;
  };

  // â”€â”€ Verify vendor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (action === 'verify_vendor') {
    const { brandId } = body;
    if (!(await ensureScope('brands', brandId))) {
      return NextResponse.json({ error: 'Forbidden: Vendor not in your university.' }, { status: 403 });
    }
    const { error } = await supabaseAdmin
      .from('brands')
      .update({ verification_status: 'verified', verified: true })
      .eq('id', brandId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // — Reject vendor ——————————————————————————————————————
  if (action === 'reject_vendor') {
    const { brandId, reason } = body;
    if (!(await ensureScope('brands', brandId))) {
      return NextResponse.json({ error: 'Forbidden: Vendor not in your university.' }, { status: 403 });
    }
    const { error } = await supabaseAdmin
      .from('brands')
      .update({ verification_status: 'rejected', rejection_reason: reason || 'Did not meet requirements.' })
      .eq('id', brandId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // — Delete vendor ——————————————————————————————————————
  if (action === 'delete_vendor') {
    const { brandId } = body;
    if (!(await ensureScope('brands', brandId))) {
      return NextResponse.json({ error: 'Forbidden: Vendor not in your university.' }, { status: 403 });
    }
    const { error } = await supabaseAdmin.from('brands').delete().eq('id', brandId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // â”€â”€ Suspend vendor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (action === 'suspend_vendor') {
    const { brandId } = body;
    if (!(await ensureScope('brands', brandId))) {
      return NextResponse.json({ error: 'Forbidden: Vendor not in your university.' }, { status: 403 });
    }
    const { error } = await supabaseAdmin
      .from('brands')
      .update({ verification_status: 'suspended', verified: false })
      .eq('id', brandId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // â”€â”€ Delete vendor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (action === 'delete_vendor') {
    const { brandId } = body;
    if (!(await ensureScope('brands', brandId))) {
      return NextResponse.json({ error: 'Forbidden: Vendor not in your university.' }, { status: 403 });
    }
    const { error } = await supabaseAdmin.from('brands').delete().eq('id', brandId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // â”€â”€ Send notification to university users â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (action === 'send_notification') {
    const { title, content, target } = body;
    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required.' }, { status: 400 });
    }

    const universityId = ctx.universityId || body.university_id;
    if (!universityId) {
      return NextResponse.json({ error: 'University scope required.' }, { status: 400 });
    }

    // Resolve target users — ONLY within this university
    let query = supabaseAdmin.from('users').select('id').eq('university_id', universityId);
    if (target === 'vendors') query = query.eq('role', 'vendor');
    else if (target === 'customers') query = query.eq('role', 'customer');
    else if (target === 'riders') query = query.eq('role', 'delivery');
    // else 'all' â†’ no extra filter

    const { data: targetUsers } = await query;
    if (targetUsers && targetUsers.length > 0) {
      const rows = targetUsers.map((u: any) => ({
        user_id: u.id,
        title,
        content,
        is_read: false,
        type: 'university_broadcast',
        university_id: universityId,
      }));
      const { error } = await supabaseAdmin.from('notifications').insert(rows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, sent: targetUsers?.length || 0 });
  }

  // â”€â”€ Assign rider to university â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (action === 'assign_rider') {
    const { userId } = body;
    const universityId = ctx.universityId || body.university_id;

    // Only super admin can re-assign riders across universities
    if (!ctx.isFullAdmin) {
      const { data: rider } = await supabaseAdmin
        .from('delivery_agents')
        .select('university_id')
        .eq('id', userId)
        .single();
      if (rider?.university_id && rider.university_id !== ctx.universityId) {
        return NextResponse.json({ error: 'Rider already assigned to another university.' }, { status: 403 });
      }
    }

    await supabaseAdmin
      .from('delivery_agents')
      .upsert({ id: userId, university_id: universityId }, { onConflict: 'id' });

    await supabaseAdmin
      .from('users')
      .update({ role: 'delivery', university_id: universityId })
      .eq('id', userId);

    return NextResponse.json({ success: true });
  }

  // â”€â”€ Verify rider â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (action === 'verify_rider') {
    const { userId } = body;
    if (!(await ensureScope('delivery_agents', userId, 'university_id'))) {
      return NextResponse.json({ error: 'Forbidden: Rider not in your university.' }, { status: 403 });
    }
    const { error } = await supabaseAdmin.from('delivery_agents').update({ is_active: true }).eq('id', userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // â”€â”€ Manage Products (Toggle Visibility/Feature) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (action === 'update_product') {
    const { productId, isVisible, isFeatured } = body;
    if (!(await ensureScope('products', productId))) {
      return NextResponse.json({ error: 'Forbidden: Product not in your university.' }, { status: 403 });
    }
    const update: any = {};
    if (isVisible !== undefined) update.is_visible = isVisible;
    if (isFeatured !== undefined) update.is_featured = isFeatured;

    const { error } = await supabaseAdmin.from('products').update(update).eq('id', productId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // â”€â”€ Delete product â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (action === 'delete_product') {
    const { productId } = body;
    if (!(await ensureScope('products', productId))) {
      return NextResponse.json({ error: 'Forbidden: Product not in your university.' }, { status: 403 });
    }
    const { error } = await supabaseAdmin.from('products').delete().eq('id', productId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // â”€â”€ Update University Config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (action === 'update_uni_config') {
    const { config } = body;
    const targetUniId = ctx.universityId || body.university_id;
    
    if (!targetUniId) return NextResponse.json({ error: 'University ID required' }, { status: 400 });
    
    // Ensure university admin can only update their own university
    if (!ctx.isFullAdmin && targetUniId !== ctx.universityId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error } = await supabaseAdmin.from('platform_settings').upsert({
      key: `uni_config_${targetUniId}`,
      value: config,
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // â”€â”€ Manage university staff (university_admin only) â”€â”€â”€â”€â”€â”€â”€â”€
  if (action === 'add_staff') {
    // Only university_admin or super_admin can add staff
    if (ctx.role !== 'university_admin' && !ctx.isFullAdmin) {
      return NextResponse.json({ error: 'Only university admins can add staff.' }, { status: 403 });
    }

    const { userId, staffRole, permissions } = body;
    const universityId = ctx.universityId || body.university_id;

    const { error } = await supabaseAdmin.from('users').update({
      role: staffRole || 'university_staff',
      university_id: universityId,
      admin_permissions: permissions || [],
    }).eq('id', userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // â”€â”€ Remove staff member â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (action === 'remove_staff') {
    if (ctx.role !== 'university_admin' && !ctx.isFullAdmin) {
      return NextResponse.json({ error: 'Only university admins can remove staff.' }, { status: 403 });
    }

    const { userId } = body;

    // Prevent demoting self
    if (userId === ctx.userId) {
      return NextResponse.json({ error: 'Cannot remove yourself.' }, { status: 400 });
    }

    // Ensure target is in same university
    if (!(await ensureScope('users', userId))) {
      return NextResponse.json({ error: 'User not in your university.' }, { status: 403 });
    }

    const { error } = await supabaseAdmin.from('users').update({
      role: 'customer',
      admin_permissions: [],
    }).eq('id', userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // â”€â”€ Toggle User Status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (action === 'toggle_user_status') {
    const { userId, status } = body;
    if (!(await ensureScope('users', userId))) {
      return NextResponse.json({ error: 'Forbidden: User not in your university.' }, { status: 403 });
    }
    const { error } = await supabaseAdmin.from('users').update({ status }).eq('id', userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // â”€â”€ BLOCK: Prevent global financial actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const FORBIDDEN_ACTIONS = [
    'confirm_payout', 'reject_payout',
    'activate_plan', 'activate_boost', 'update_visibility_price',
    'create_promo_code', 'delete_promo_code'
  ];

  if (FORBIDDEN_ACTIONS.includes(action) && !ctx.isFullAdmin) {
    return NextResponse.json({
      error: 'Forbidden: University admins cannot access global financial or promo controls.',
    }, { status: 403 });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}


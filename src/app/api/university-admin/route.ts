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
        .select('id, title, sales_count, views_count, product_section')
        .eq('university_id', universityId)
        .order('sales_count', { ascending: false })
        .limit(5),
    ]);

    const orders = ordersRes.data || [];
    const paidStatuses = ['paid', 'preparing', 'ready', 'picked_up', 'in_transit', 'delivered', 'received'];
    const paidOrders = orders.filter((o: any) => paidStatuses.includes(o.status));
    const completedOrders = orders.filter((o: any) => o.status === 'delivered' || o.status === 'received');
    const totalRevenue = paidOrders.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);
    const acquiredRevenue = completedOrders.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);

    // Projected Revenue: Value of active stock
    const { data: stockData } = await supabaseAdmin
      .from('products')
      .select('price, stock_count, product_section')
      .eq('university_id', universityId)
      .eq('is_visible', true);
    
    const activeStockCount = (stockData || []).reduce((sum, p) => sum + (Number(p.stock_count) || 0), 0);
    const projectedRevenue = (stockData || []).reduce((sum, p) => sum + (Number(p.price) * (Number(p.stock_count) || 0)), 0);

    return NextResponse.json({
      stats: {
        totalUsers: usersRes.count ?? 0,
        totalVendors: vendorsRes.count ?? 0,
        totalOrders: orders.length,
        paidOrders: paidOrders.length,
        totalRevenue, // paid but not necessarily completed
        acquiredRevenue, // completed (money already made)
        projectedRevenue, // stock value (potential revenue)
        activeStockCount, // total units/plates available
        totalRiders: ridersRes.count ?? 0,
        popularProducts: productsRes.data || [],
      },
    });
  }

  // â”€â”€ Vendors in university â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (action === 'vendors') {
    const { data: brandData, error } = await supabaseAdmin
      .from('brands')
      .select('id, name, description, verification_status, verified, subscription_tier, owner_id, created_at, university_id')
      .eq('university_id', universityId)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Fetch owner names separately
    const ownerIds = (brandData || []).map((b: any) => b.owner_id).filter(Boolean);
    let ownerMap: Record<string, any> = {};
    if (ownerIds.length > 0) {
      const { data: ownerData } = await supabaseAdmin
        .from('users')
        .select('id, name, email, phone')
        .in('id', ownerIds);
      (ownerData || []).forEach((u: any) => { ownerMap[u.id] = u; });
    }

    const vendors = (brandData || []).map((b: any) => ({
      ...b,
      users: ownerMap[b.owner_id] || null,
    }));
    return NextResponse.json({ vendors });
  }

  // ── Customers (users) in university ──────────────────────
  if (action === 'customers') {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, name, email, phone, role, status, created_at, university_id')
      .eq('university_id', universityId)
      .neq('status', 'deleted')
      .not('role', 'in', '("admin","super_admin")') // exclude global admins
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Return customers with a display_name fallback
    const customers = (data || []).map((u: any) => ({
      ...u,
      display_name: u.name || u.email?.split('@')[0] || 'Unknown User',
    }));
    return NextResponse.json({ customers });
  }

  // ── Recycle Bin: fetch soft-deleted users ───────────────
  if (action === 'deleted_users') {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, name, email, phone, role, status, deleted_at, deleted_reason, created_at, university_id')
      .eq('university_id', universityId)
      .eq('status', 'deleted')
      .order('deleted_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ deletedUsers: data || [] });
  }

  // ── Orders in university ──────────────────────────────────
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
    // Fetch delivery agents and then join user profile data separately
    const { data: agentData, error } = await supabaseAdmin
      .from('delivery_agents')
      .select('id, is_active, wallet_balance, completed_orders_count, created_at, university_id')
      .eq('university_id', universityId)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Fetch user details for each agent
    const agentIds = (agentData || []).map((a: any) => a.id);
    let userMap: Record<string, any> = {};
    if (agentIds.length > 0) {
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('id, name, email, phone')
        .in('id', agentIds);
      (userData || []).forEach((u: any) => { userMap[u.id] = u; });
    }

    const transformed = (agentData || []).map((a: any) => ({
      ...a,
      name: userMap[a.id]?.name || 'Unknown Rider',
      email: userMap[a.id]?.email || 'N/A',
      phone: userMap[a.id]?.phone || 'N/A',
    }));
    return NextResponse.json({ riders: transformed });
  }

  // â”€â”€ Analytics — trend data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (action === 'analytics') {
    const period = searchParams.get('period') || '30d';
    const paidStatuses = ['paid', 'preparing', 'ready', 'picked_up', 'in_transit', 'delivered', 'received'];

    // Calculate start date from period
    const now = new Date();
    let startDate: Date | null = null;
    if (period === '7d') startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (period === '30d') startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    else if (period === '90d') startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    // 'all' = no date filter

    let query = supabaseAdmin
      .from('orders')
      .select('created_at, total_amount, status')
      .eq('university_id', universityId)
      .order('created_at', { ascending: true });

    if (startDate) query = query.gte('created_at', startDate.toISOString());

    const { data: ordersData } = await query;

    // Group by day (7d/30d) or by week (90d/all)
    const groupByWeek = period === '90d' || period === 'all';

    const aggregated = (ordersData || []).reduce((acc: any, curr: any) => {
      let key: string;
      const d = new Date(curr.created_at);
      if (groupByWeek) {
        // Group by week: "Week of DD MMM"
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        key = 'W/C ' + weekStart.toLocaleDateString('en-NG', { day: '2-digit', month: 'short' });
      } else {
        key = d.toLocaleDateString('en-NG', { day: '2-digit', month: 'short' });
      }
      if (!acc[key]) acc[key] = { orders: 0, revenue: 0 };
      acc[key].orders += 1;
      if (paidStatuses.includes(curr.status)) acc[key].revenue += Number(curr.total_amount || 0);
      return acc;
    }, {});

    const chartData = Object.entries(aggregated).map(([time, val]: any) => ({
      time,
      orders: val.orders,
      revenue: val.revenue,
    }));

    // Summary stats
    const allOrders = ordersData || [];
    const totalRevenue = allOrders.filter((o: any) => paidStatuses.includes(o.status)).reduce((s: number, o: any) => s + Number(o.total_amount || 0), 0);
    const totalOrders = allOrders.length;
    const paidOrdersCount = allOrders.filter((o: any) => paidStatuses.includes(o.status)).length;

    return NextResponse.json({ chartData, summary: { totalRevenue, totalOrders, paidOrdersCount, period } });
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
    const productSection = searchParams.get('product_section');
    
    let query = supabaseAdmin
      .from('products')
      .select('*, brands(name)')
      .eq('university_id', universityId)
      .order('created_at', { ascending: false });

    if (productSection) {
      query = query.eq('product_section', productSection);
    }

    const { data, error } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ products: data || [] });
  }

  if (action === 'merchandising') {
    const { data, error } = await supabaseAdmin
      .from('homepage_sections')
      .select('*')
      .eq('university_id', universityId)
      .order('priority', { ascending: true });
    
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ sections: data || [] });
  }

  if (action === 'promo_codes') {
    let query = supabaseAdmin
      .from('promo_codes')
      .select('*, brands(name), products(title)')
      .order('created_at', { ascending: false });

    // Try university_id filter — fallback gracefully if column missing
    try {
      const { data, error } = await query.eq('university_id', universityId);
      if (error && error.message.includes('column')) {
        const { data: fallbackData } = await supabaseAdmin.from('promo_codes').select('*, brands(name), products(title)').order('created_at', { ascending: false });
        return NextResponse.json({ promoCodes: fallbackData || [] });
      }
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ promoCodes: data || [] });
    } catch {
      return NextResponse.json({ promoCodes: [] });
    }
  }

  if (action === 'notices') {
    const { data, error } = await supabaseAdmin
      .from('university_notices')
      .select('*')
      .eq('university_id', universityId)
      .order('created_at', { ascending: false });
    if (error) {
      if (error.message.includes('does not exist')) return NextResponse.json({ notices: [] });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ notices: data || [] });
  }

  if (action === 'billboards') {
    // Fetch from dedicated table first, fall back to platform_settings
    const { data: tableData, error: tableErr } = await supabaseAdmin
      .from('manual_billboards')
      .select('*')
      .eq('university_id', universityId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (!tableErr) return NextResponse.json({ billboards: tableData || [] });
    
    // Fallback: platform_settings
    const { data: settingData } = await supabaseAdmin.from('platform_settings').select('value').eq('key', 'manual_billboards').single();
    const all = (settingData?.value as any[]) || [];
    const filtered = all.filter((b: any) => !b.university_id || b.university_id === universityId);
    return NextResponse.json({ billboards: filtered });
  }

  if (action === 'university_config') {
    const { data: config } = await supabaseAdmin
      .from('platform_settings')
      .select('value')
      .eq('key', `uni_config_${universityId}`)
      .single();
    
    return NextResponse.json({ config: config?.value || {} });
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
  const universityId = ctx.universityId;

  // Helper: enforce university scope on a target record
  const ensureScope = async (table: string, id: string, column = 'university_id') => {
    if (ctx.isFullAdmin) return true; 
    const { data } = await supabaseAdmin.from(table).select(column).eq('id', id).single();
    if (!data) return false;
    
    const recordUniId = (data as any)[column];
    const userUniId = ctx.universityId;
    
    if (!recordUniId || !userUniId) return false;
    return String(recordUniId) === String(userUniId);
  };

  // â”€â”€ Verify vendor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (action === 'verify_vendor') {
    const { brandId } = body;
    if (!(await ensureScope('brands', brandId))) {
      return NextResponse.json({ error: 'Forbidden: Vendor not in your university.' }, { status: 403 });
    }
    // 1. Update brand verification status
    const { error } = await supabaseAdmin
      .from('brands')
      .update({ verification_status: 'verified', verified: true, fee_paid: true })
      .eq('id', brandId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    
    // 2. Promote owner's user role to 'vendor'
    const { data: brand } = await supabaseAdmin.from('brands').select('owner_id').eq('id', brandId).single();
    if (brand?.owner_id) {
      await supabaseAdmin.from('users').update({ role: 'vendor' }).eq('id', brand.owner_id);
      await supabaseAdmin.auth.admin.updateUserById(brand.owner_id, { user_metadata: { role: 'vendor' } });
      // 3. Send notification to the vendor
      await supabaseAdmin.from('notifications').insert({
        user_id: brand.owner_id,
        title: '🎉 Your Store Has Been Verified!',
        content: 'Congratulations! Your vendor application has been approved by the campus admin. Your store is now live. Go to your vendor dashboard to start listing products!',
        is_read: false,
        type: 'direct',
        link: '/dashboard/vendor'
      });
    }
    
    return NextResponse.json({ success: true, message: 'Vendor verified and role promoted to vendor.' });
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

  // ─── Delete vendor ────────────────────────────────────────────────────────────
  if (action === 'delete_vendor') {
    const { brandId } = body;
    if (!(await ensureScope('brands', brandId))) {
      return NextResponse.json({ error: 'Forbidden: Vendor not in your university.' }, { status: 403 });
    }
    const { error } = await supabaseAdmin.from('brands').delete().eq('id', brandId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // ─── Add Manual Billboard ───────────────────────────────────────────────────
  if (action === 'add_manual_billboard') {
    const { title, description, link, cover_url } = body;
    const { data: exist } = await supabaseAdmin.from('platform_settings').select('value').eq('key', 'manual_billboards').single();
    const list = (exist?.value as any[]) || [];
    list.push({ 
      id: `mb_${Date.now()}`, 
      title, 
      description, 
      link, 
      cover_url, 
      university_id: ctx.universityId 
    });
    const { error } = await supabaseAdmin.from('platform_settings').upsert({ key: 'manual_billboards', value: list, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // ─── Remove Manual Billboard (University-scoped) ────────────────────────────
  if (action === 'remove_manual_billboard') {
    const { billboardId } = body;
    const { data: exist } = await supabaseAdmin.from('platform_settings').select('value').eq('key', 'manual_billboards').single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const all = (exist?.value as any[]) || [];
    // Security: only remove billboards that belong to this university
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filtered = all.filter((b: any) => {
      if (b.id !== billboardId) return true; // keep
      // allow removal only if it belongs to this university (or super admin)
      if (ctx.isFullAdmin) return false;
      return b.university_id !== ctx.universityId; // only remove own university's billboards
    });
    const { error } = await supabaseAdmin.from('platform_settings').upsert({ key: 'manual_billboards', value: filtered, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }


  // ─── Toggle User Status (Suspend/Activate Delivery, Customer) ───────────────
  if (action === 'toggle_user_status') {
    const { userId, status } = body;
    if (!(await ensureScope('users', userId))) {
      return NextResponse.json({ error: 'Forbidden: User not in your university.' }, { status: 403 });
    }
    const { error } = await supabaseAdmin.from('users').update({ status }).eq('id', userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, message: `User status updated to ${status}.` });
  }

  // ─── Soft Delete User (University Admin scoped) ─────────────────────────────────
  if (action === 'delete_user') {
    const { userId, reason } = body;
    if (!(await ensureScope('users', userId))) {
      return NextResponse.json({ error: 'Forbidden: User not in your university.' }, { status: 403 });
    }
    // Soft-delete: set status='deleted', ban from auth
    const { error } = await supabaseAdmin
      .from('users')
      .update({
        status: 'deleted',
        deleted_at: new Date().toISOString(),
        deleted_by_super_admin: false,
        deleted_reason: reason || null
      })
      .eq('id', userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Ban auth session
    try {
      await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: '876000h' });
    } catch (e) {
      console.warn('[UADMIN API] Auth ban failed for', userId);
    }
    return NextResponse.json({ success: true, message: 'User moved to Recycle Bin.' });
  }

  // ─── Restore User from Recycle Bin (University Admin scoped) ──────────────────
  if (action === 'restore_user') {
    const { userId } = body;
    if (!(await ensureScope('users', userId))) {
      return NextResponse.json({ error: 'Forbidden: User not in your university.' }, { status: 403 });
    }
    // Only university admins can restore unless deleted by super admin
    const { data: targetUser } = await supabaseAdmin.from('users').select('deleted_by_super_admin').eq('id', userId).single();
    if (targetUser?.deleted_by_super_admin && !ctx.isFullAdmin) {
      return NextResponse.json({ error: 'Only the Super Admin can restore this account.' }, { status: 403 });
    }
    const { error } = await supabaseAdmin
      .from('users')
      .update({ status: 'active', deleted_at: null, deleted_by_super_admin: false, deleted_reason: null })
      .eq('id', userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    try {
      await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: 'none' });
    } catch (e) {
      console.warn('[UADMIN API] Auth unban failed for', userId);
    }
    return NextResponse.json({ success: true, message: 'User account restored successfully.' });
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
    
    // Activate the rider agent record
    await supabaseAdmin.from('delivery_agents').update({ is_active: true }).eq('id', userId);
    
    // CRITICAL: Grant access to delivery dashboard by updating role
    const { error } = await supabaseAdmin.from('users').update({ role: 'delivery' }).eq('id', userId);
    
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // — Revoke rider (deactivate) ————————————————————————————
  if (action === 'revoke_rider') {
    const { userId } = body;
    if (!(await ensureScope('delivery_agents', userId, 'university_id'))) {
      return NextResponse.json({ error: 'Forbidden: Rider not in your university.' }, { status: 403 });
    }
    const { error } = await supabaseAdmin.from('delivery_agents').update({ is_active: false }).eq('id', userId);
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

  // — Update University Config ————————————————————————————
  if (action === 'update_uni_config') {
    const { key, value } = body;
    // Use target university from body if super admin, otherwise use context uni
    const targetUniId = (ctx.isFullAdmin && body.university_id) ? body.university_id : ctx.universityId;
    
    if (!targetUniId) return NextResponse.json({ error: 'University ID required for configuration update.' }, { status: 400 });
    
    // Security check: ensure university admin only updates their own campus
    if (!ctx.isFullAdmin && targetUniId !== ctx.universityId) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to manage this university.' }, { status: 403 });
    }

    const configKey = `uni_config_${targetUniId}`;
    const { data: exist } = await supabaseAdmin.from('platform_settings').select('value').eq('key', configKey).single();
    const config = (exist?.value as any) || {};
    
    if (key) {
      config[key] = value;
    } else if (body.config) {
      Object.assign(config, body.config);
    }

    const { error } = await supabaseAdmin.from('platform_settings').upsert({
      key: configKey,
      value: config,
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, message: 'University configuration updated.' });
  }

  // â”€â”€ Manage university staff (university_admin only) â”€â”€â”€â”€â”€â”€â”€â”€
  if (action === 'add_staff') {
    // ONLY the primary university_admin (head) or super admin can add staff
    if (ctx.role !== 'university_admin' && !ctx.isFullAdmin) {
      return NextResponse.json({ error: 'Only the head university admin can manage team members.' }, { status: 403 });
    }

    const { userId, staffRole, permissions } = body;
    const uniId = ctx.universityId || body.university_id;

    // Enforce 10-member team cap (excluding the head admin themselves)
    const { count: currentCount } = await supabaseAdmin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('university_id', uniId)
      .in('role', ['university_admin', 'university_staff']);

    if ((currentCount || 0) >= 10) {
      return NextResponse.json({ error: 'Team limit reached. Maximum 10 members per university team.' }, { status: 400 });
    }

    // Prevent assigning admin role (super admin only can do that)
    const safeRole = (staffRole === 'university_admin' && !ctx.isFullAdmin) ? 'university_staff' : (staffRole || 'university_staff');

    const { error } = await supabaseAdmin.from('users').update({
      role: safeRole,
      university_id: uniId,
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

  // --- Merchandising Actions ---
  if (action === 'create_homepage_section') {
    const { title, type, layout_type, auto_rule, priority, is_active } = body;
    const { data, error } = await supabaseAdmin.from('homepage_sections').insert({
      title, type, layout_type, auto_rule: auto_rule || {}, priority: priority || 0, 
      university_id: universityId, // Enforced scope
      is_active: is_active ?? true
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, section: data });
  }

  if (action === 'update_homepage_section') {
    const { id, updates } = body;
    // Ensure we only update sections belonging to this university
    const { error } = await supabaseAdmin.from('homepage_sections').update(updates).eq('id', id).eq('university_id', universityId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'delete_homepage_section') {
    const { id } = body;
    const { error } = await supabaseAdmin.from('homepage_sections').delete().eq('id', id).eq('university_id', universityId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'assign_product_to_section') {
    const { sectionId, productId, position } = body;
    // Verify section belongs to university
    const { data: sec } = await supabaseAdmin.from('homepage_sections').select('university_id').eq('id', sectionId).single();
    if (!sec || sec.university_id !== universityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { error } = await supabaseAdmin.from('section_products').upsert({
      section_id: sectionId, product_id: productId, position: position || 0
    }, { onConflict: 'section_id,product_id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'remove_product_from_section') {
    const { sectionId, productId } = body;
    // Verify section belongs to university
    const { data: sec } = await supabaseAdmin.from('homepage_sections').select('university_id').eq('id', sectionId).single();
    if (!sec || sec.university_id !== universityId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { error } = await supabaseAdmin.from('section_products').delete().eq('section_id', sectionId).eq('product_id', productId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // ─── Promo Codes Management ────────────────────────────────────────────────
  if (action === 'create_promo_code') {
    const { code, type, value, max_uses, product_id, brand_id } = body;
    if (!code || !type || value === undefined) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });

    // brand_id is now OPTIONAL (nullable in DB after migration)
    const insertData: any = {
      code: code.toUpperCase(),
      type,
      value: Number(value),
      max_uses: max_uses || null,
      product_id: product_id || null,
      brand_id: brand_id || null, // nullable — platform-wide codes have no brand
      university_id: ctx.universityId,
      is_active: true,
      created_by: ctx.userId,
    };

    const { error } = await supabaseAdmin.from('promo_codes').insert(insertData);
    if (error) {
      // Fallback: drop optional fields if schema is old
      if (error.message.includes('column') || error.message.includes('schema cache')) {
        delete insertData.university_id;
        delete insertData.created_by;
        const { error: fallbackErr } = await supabaseAdmin.from('promo_codes').insert(insertData);
        if (fallbackErr) return NextResponse.json({ error: fallbackErr.message }, { status: 500 });
        return NextResponse.json({ success: true });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  // ─── Create University Notice ────────────────────────────────────────────────
  if (action === 'create_notice') {
    const { title, content, notice_type, expires_at } = body;
    if (!title || !content) return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    
    const { error } = await supabaseAdmin.from('university_notices').insert({
      title,
      content,
      notice_type: notice_type || 'general',
      university_id: universityId,
      created_by: ctx.userId,
      is_active: true,
      expires_at: expires_at || null,
    });
    if (error) {
      if (error.message.includes('does not exist')) {
        return NextResponse.json({ error: 'Please run the mega_patch_migrations.sql in Supabase dashboard first.' }, { status: 500 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  // ─── Delete Notice ─────────────────────────────────────────────────────────
  if (action === 'delete_notice') {
    const { noticeId } = body;
    const { error } = await supabaseAdmin.from('university_notices').delete().eq('id', noticeId).eq('university_id', universityId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // ─── Manual Billboard (scoped table) ──────────────────────────────────────
  if (action === 'add_manual_billboard') {
    const { title, description, link, cover_url } = body;
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    
    // Try dedicated table first
    const { error: tableErr } = await supabaseAdmin.from('manual_billboards').insert({
      title,
      description,
      link,
      cover_url,
      university_id: ctx.universityId,
      created_by: ctx.userId,
      is_active: true,
    });
    
    if (!tableErr) return NextResponse.json({ success: true });
    
    // Fallback: platform_settings JSON array
    const { data: exist } = await supabaseAdmin.from('platform_settings').select('value').eq('key', 'manual_billboards').single();
    const list = (exist?.value as any[]) || [];
    list.push({ id: `mb_${Date.now()}`, title, description, link, cover_url, university_id: ctx.universityId });
    const { error } = await supabaseAdmin.from('platform_settings').upsert({ key: 'manual_billboards', value: list, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'delete_promo_code') {
    const { codeId } = body;
    // Verify ownership
    const { data: promo } = await supabaseAdmin.from('promo_codes').select('university_id').eq('id', codeId).single();
    if (!promo || (promo.university_id !== ctx.universityId && !ctx.isFullAdmin)) {
      return NextResponse.json({ error: 'Unauthorized or not found' }, { status: 401 });
    }

    const { error } = await supabaseAdmin.from('promo_codes').delete().eq('id', codeId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // ── BLOCK: Prevent global financial actions ──────────────────────────────────
  const FORBIDDEN_ACTIONS = [
    'confirm_payout', 'confirm_escrow_release', 'reject_payout',
    'activate_plan', 'activate_boost', 'update_visibility_price'
  ];

  if (FORBIDDEN_ACTIONS.includes(action) && !ctx.isFullAdmin) {
    return NextResponse.json({
      error: 'Forbidden: University admins cannot access global financial or payout controls.',
    }, { status: 403 });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}


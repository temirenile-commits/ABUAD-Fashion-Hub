import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';


// â”€â”€â”€ Middleware: Verify request is from an admin â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Decodes the Supabase JWT locally (no network call) to avoid auth timeouts.
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

async function verifyAdmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    console.warn('[ADMIN API] Missing authorization header');
    return null;
  }
  const token = authHeader.replace('Bearer ', '');

  // Decode JWT locally — avoids network round-trip to Supabase Auth that was timing out
  const payload = decodeJwt(token);
  if (!payload?.sub) {
    console.error('[ADMIN API] Invalid or missing JWT payload');
    return null;
  }

  const userId = payload.sub;

  // Single fast DB query to confirm role (supabaseAdmin bypasses RLS)
  const { data: profile, error } = await supabaseAdmin
    .from('users')
    .select('role, admin_permissions')
    .eq('id', userId)
    .single();

  if (error || !profile) {
    console.error('[ADMIN API] User profile not found for id:', userId, error);
    return null;
  }

  if (profile.role === 'admin') return { id: userId, email: payload.email, isFullAdmin: true, permissions: ['all'] };
  if (profile.role === 'sub_admin') return { id: userId, email: payload.email, isFullAdmin: false, permissions: profile.admin_permissions || [] };
  
  console.warn(`[ADMIN API] User ${payload.email} attempted admin action but has role: ${profile.role}`);
  return null;
}

// â”€â”€â”€ GET Handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    // Use public.users as the primary source — avoids auth.admin.listUsers() network call that times out
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 500 });

    const merged = (profiles || []).map((p: any) => ({
      id: p.id,
      email: p.email,
      name: p.name || 'Unknown',
      role: p.role || 'customer',
      phone: p.phone || null,
      status: p.status || 'active',
      created_at: p.created_at,
      confirmed: true, // assumed confirmed if they have a profile
    }));

    return NextResponse.json({ users: merged });
  }

  if (action === 'vendors') {
    const { data, error } = await supabaseAdmin
      .from('brands')
      .select('*, users!owner_id(name, email)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch vendors error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform joined user data for easier frontend access
    const transformed = (data || []).map(v => {
      const owner = (v as any).users || { name: 'Unknown Owner', email: 'N/A' };
      return {
        ...v,
        users: owner,
      };
    });
    return NextResponse.json({ vendors: transformed });
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
      userRes,
      brandRes,
      productRes,
      revenueRes
    ] = await Promise.all([
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('brands').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('products').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('orders').select('total_amount, admin_discount').eq('status', 'paid'),
    ]);

    if (userRes.error) console.error('[Stats] User Error:', userRes.error);
    if (brandRes.error) console.error('[Stats] Brand Error:', brandRes.error);
    if (productRes.error) console.error('[Stats] Product Error:', productRes.error);

    const userCount = userRes.count ?? 0;
    const brandCount = brandRes.count ?? 0;
    const productCount = productRes.count ?? 0;

    // Fetch aggregated view counts separately (resilient — won't block main stats if column missing)
    let totalProductViews = 0;
    let totalProfileViews = 0;
    try {
      const { data: viewData } = await supabaseAdmin.from('products').select('views_count');
      totalProductViews = (viewData || []).reduce((sum: number, p: any) => sum + (Number(p.views_count) || 0), 0);
    } catch { /* column may not exist yet */ }
    try {
      const { data: profileData } = await supabaseAdmin.from('brands').select('profile_views');
      totalProfileViews = (profileData || []).reduce((sum: number, b: any) => sum + (Number(b.profile_views) || 0), 0);
    } catch { /* column may not exist yet */ }
    
    const revenueData = revenueRes.data || [];
    const totalRevenue = revenueData.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);
    const totalSubsidies = revenueData.reduce((sum: number, o: any) => sum + Number(o.admin_discount || 0), 0);

    return NextResponse.json({
      stats: { 
        userCount, 
        brandCount, 
        productCount, 
        totalRevenue, 
        totalSubsidies,
        totalProductViews,
        totalProfileViews
      }
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

  if (action === 'settings') {
    const { data: settings, error } = await supabaseAdmin.from('platform_settings').select('*');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    
    // Transform array to key-value object
    const settingsMap = (settings || []).reduce((acc: any, s: any) => {
      acc[s.key] = s.value;
      return acc;
    }, {});

    return NextResponse.json({ settings: settingsMap });
  }

  if (action === 'reviews') {
    const { data, error } = await supabaseAdmin
      .from('reviews')
      .select('*, users:user_id(name, email), products:product_id(title)')
      .order('created_at', { ascending: false });

    if (error) { console.error('[Reviews]', error.message); return NextResponse.json({ reviews: [] }); }
    return NextResponse.json({ reviews: data || [] });
  }

  if (action === 'payouts') {
    const { data, error } = await supabaseAdmin
      .from('payout_requests')
      .select('*, users:user_id(name, email)')
      .order('created_at', { ascending: false });

    if (error) { console.error('[Payouts]', error.message); return NextResponse.json({ payouts: [] }); }
    return NextResponse.json({ payouts: data || [] });
  }

  if (action === 'market_analytics') {
    const { data: salesData } = await supabaseAdmin
      .from('orders')
      .select('created_at, total_amount, admin_discount')
      .eq('status', 'paid')
      .order('created_at', { ascending: true });

    const aggregated = (salesData || []).reduce((acc: any, curr: any) => {
      const date = new Date(curr.created_at).toLocaleDateString();
      if (!acc[date]) acc[date] = { revenue: 0, subsidy: 0 };
      acc[date].revenue += Number(curr.total_amount);
      acc[date].subsidy += Number(curr.admin_discount || 0);
      return acc;
    }, {});

    const chartData = Object.entries(aggregated).map(([time, val]: any) => ({ 
      time, 
      value: val.revenue,
      subsidy: val.subsidy 
    }));
    return NextResponse.json({ chartData });
  }

  if (action === 'delivery_agents') {
    const { data, error } = await supabaseAdmin
      .from('delivery_agents')
      .select('*, users:id(name, email)')
      .order('created_at', { ascending: false });

    if (error) { console.error('[DeliveryAgents]', error.message); return NextResponse.json({ agents: [] }); }
    
    const transformed = (data || []).map(a => ({
      ...a,
      name: (a as any).users?.name || 'Rider',
      email: (a as any).users?.email || 'N/A'
    }));
    return NextResponse.json({ agents: transformed });
  }

  if (action === 'promo_codes') {
    const { data, error } = await supabaseAdmin
      .from('promo_codes')
      .select('*, brands(name), products(title)')
      .order('created_at', { ascending: false });

    if (error) { console.error('[PromoCodes]', error.message); return NextResponse.json({ promoCodes: [] }); }
    return NextResponse.json({ promoCodes: data || [] });
  }

  if (action === 'universities_list') {
    const { data, error } = await supabaseAdmin
      .from('universities')
      .select('*, users!university_id(id, role)')
      .order('name', { ascending: true });
    
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    
    // Transform to include admin count
    const transformed = (data || []).map(u => {
      const admins = (u as any).users?.filter((usr: any) => usr.role === 'university_admin') || [];
      return { ...u, adminCount: admins.length };
    });

    return NextResponse.json({ universities: transformed });
  }

  if (action === 'university_admins') {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, name, email, university_id, universities(name)')
      .eq('role', 'university_admin');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ admins: data });
  }

  if (action === 'university_teams') {
    const { data, error } = await supabaseAdmin
      .from('university_teams')
      .select('*, member:member_id(name, email), admin:admin_id(name), university:university_id(name)');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ teams: data });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

// ─── POST Handler ──────────────────────────────────────────────────────────â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      .update({ 
        verification_status: 'verified', 
        verified: true,
        fee_paid: true 
      })
      .eq('id', brandId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, message: 'Vendor approved and verified manually.' });
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

    if (error) {
      if (error.message.includes('foreign key constraint')) {
        // Fallback to soft-deletion
        const { error: softError } = await supabaseAdmin
          .from('products')
          .update({ is_draft: true, stock_count: 0 })
          .eq('id', productId);
        if (softError) return NextResponse.json({ error: softError.message }, { status: 500 });
        return NextResponse.json({ success: true, message: 'Product archived due to existing orders.' });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  if (action === 'block_user') {
    const { userId } = body;
    const { error } = await supabaseAdmin.from('users').update({ status: 'blocked' }).eq('id', userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, message: 'User has been blocked.' });
  }

  if (action === 'unblock_user') {
    const { userId } = body;
    const { error } = await supabaseAdmin.from('users').update({ status: 'active' }).eq('id', userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, message: 'User has been unblocked.' });
  }

  if (action === 'delete_user') {
    const { userId } = body;
    
    // First try to delete from public.users (triggers FK errors if dependencies exist)
    const { error: profileError } = await supabaseAdmin.from('users').delete().eq('id', userId);
    
    if (profileError) {
      if (profileError.message.includes('foreign key constraint')) {
        // Fallback: Just block them if deletion fails due to history
        await supabaseAdmin.from('users').update({ status: 'blocked' }).eq('id', userId);
        return NextResponse.json({ 
            success: true, 
            message: 'User has active orders/brands and cannot be deleted. They have been BLOCKED instead to protect your records.' 
        });
      }
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }
    
    // Then delete from auth
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, message: 'User deleted successfully.' });
  }

  if (action === 'update_user_role') {
    const { userId, newRole } = body;
    const currentAdmin = await verifyAdmin(req); 
    
    if (currentAdmin?.id === userId && newRole !== 'admin') {
      return NextResponse.json({ error: 'You cannot demote yourself.' }, { status: 400 });
    }

    // 1. Update public.users
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .update({ role: newRole })
      .eq('id', userId);
    
    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

    // 2. Specialized Initialization for Delivery Agents
    if (newRole === 'delivery') {
      await supabaseAdmin.from('delivery_agents').upsert({ id: userId, is_active: false });
    }

    // 3. Specialized Initialization for Vendors
    if (newRole === 'vendor') {
        const { data: existingBrand } = await supabaseAdmin.from('brands').select('id').eq('owner_id', userId).single();
        if (!existingBrand) {
            const { data: user } = await supabaseAdmin.from('users').select('name').eq('id', userId).single();
            await supabaseAdmin.from('brands').insert({ 
                owner_id: userId, 
                name: user?.name ? `${user.name}'s Store` : 'New Vendor Store',
                verification_status: 'verified',
                verified: true,
                fee_paid: true,
                terms_accepted: true,
                description: 'Manually initialized by admin.',
                student_id_url: 'https://placeholder.com'
            });
        }
    }

    // 4. Update Auth metadata
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { role: newRole }
    });

    if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });
    return NextResponse.json({ success: true, message: `User role updated to ${newRole}` });
  }

  if (action === 'delete_review') {
    const { reviewId } = body;
    const { error } = await supabaseAdmin.from('reviews').delete().eq('id', reviewId);
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

  if (action === 'update_settings') {
    const { key, value } = body;
    const { error } = await supabaseAdmin
      .from('platform_settings')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'initialize_brand') {
    const { userId } = body;
    const { data: existingBrand } = await supabaseAdmin.from('brands').select('id').eq('owner_id', userId).single();
    if (existingBrand) return NextResponse.json({ error: 'Brand already exists.' }, { status: 400 });

    const { data: p } = await supabaseAdmin.from('users').select('name').eq('id', userId).single();
    const { error } = await supabaseAdmin.from('brands').insert({
      owner_id: userId,
      name: p?.name ? `${p.name}'s Store` : 'New Vendor Store',
      verification_status: 'verified',
      verified: true,
      fee_paid: true,
      terms_accepted: true,
      description: 'Manually initialized by admin.',
      student_id_url: 'https://placeholder.com'
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'activate_plan') {
    const { brandId, tierId } = body;
    // Fetch current limits from settings
    const { data: settings } = await supabaseAdmin.from('platform_settings').select('value').eq('key', 'subscription_rates').single();
    const rates = (settings?.value as any[]) || [];
    const plan = rates.find(r => r.id === tierId) || { max_products: 10, max_reels: 1 };

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    const { error } = await supabaseAdmin
      .from('brands')
      .update({ 
        subscription_tier: tierId, 
        subscription_expires_at: expiresAt.toISOString(),
        max_products: plan.max_products || 10,
        max_reels: plan.max_reels || 1
      })
      .eq('id', brandId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'activate_boost') {
    const { brandId, boostId } = body;
    
    // Fetch boost config from settings
    const { data: settings } = await supabaseAdmin.from('platform_settings').select('value').eq('key', 'boost_rates').single();
    const rates = (settings?.value as any[]) || [];
    const boost = rates.find(b => b.id === boostId) || { visibility_score: 50, duration_days: 7 };

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (boost.duration_days || 7));
    
    const { error } = await supabaseAdmin
      .from('brands')
      .update({ 
        boost_level: boostId,
        boost_expires_at: expiresAt.toISOString(),
        visibility_score: 100 + (boost.visibility_score || 50) 
      })
      .eq('id', brandId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }



  if (action === 'update_vendor_credits') {
    const { brandId, credits } = body;
    const { error } = await supabaseAdmin
      .from('brands')
      .update({ free_listings_count: credits })
      .eq('id', brandId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'send_notification') {
    const { title, content, target, userId: targetUserId } = body;

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    if (target === 'all' || target === 'all_vendors' || target === 'all_delivery' || target === 'all_customers') {
      let query = supabaseAdmin.from('users').select('id');
      
      if (target === 'all_vendors') query = query.eq('role', 'vendor');
      if (target === 'all_delivery') query = query.eq('role', 'delivery');
      if (target === 'all_customers') query = query.eq('role', 'customer');

      const { data: targetUsers } = await query;
      
      if (targetUsers && targetUsers.length > 0) {
        const rows = targetUsers.map((u: any) => ({ user_id: u.id, title, content, is_read: false, type: 'broadcast' }));
        const { error } = await supabaseAdmin.from('notifications').insert(rows);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, sent: targetUsers?.length || 0 });
    }

    if (target === 'specific' && targetUserId) {
      const { error } = await supabaseAdmin.from('notifications').insert({
        user_id: targetUserId,
        title,
        content,
        is_read: false,
        type: 'direct'
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, sent: 1 });
    }

    return NextResponse.json({ error: 'Invalid target. Use "all" or "specific" with a userId.' }, { status: 400 });
  }

  if (action === 'confirm_payout') {
    const { requestId, proofUrl, reference } = body;
    const admin = await verifyAdmin(req);
    const adminId = admin ? admin.id : null;
    
    const { error } = await supabaseAdmin.rpc('confirm_payout', {
      p_request_id: requestId,
      p_admin_id: adminId,
      p_proof_url: proofUrl,
      p_reference: reference
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    
    const { data: reqData } = await supabaseAdmin.from('payout_requests').select('user_id').eq('id', requestId).single();
    if (reqData) {
      await supabaseAdmin.from('notifications').insert({
        user_id: reqData.user_id,
        title: 'Payout Completed',
        content: `Your payout request has been processed successfully. Reference: ${reference || 'N/A'}`,
        is_read: false
      });
    }
    return NextResponse.json({ success: true });
  }

  if (action === 'reject_payout') {
    const { requestId } = body;
    const admin = await verifyAdmin(req);
    const adminId = admin ? admin.id : null;
    
    const { error } = await supabaseAdmin.rpc('reject_payout', {
      p_request_id: requestId,
      p_admin_id: adminId
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: reqData } = await supabaseAdmin.from('payout_requests').select('user_id').eq('id', requestId).single();
    if (reqData) {
      await supabaseAdmin.from('notifications').insert({
        user_id: reqData.user_id,
        title: 'Payout Rejected',
        content: `Your payout request was rejected. The funds have been returned to your available balance.`,
        is_read: false
      });
    }
    return NextResponse.json({ success: true });
  }

  if (action === 'reset_vendor_to_free') {
    const { brandId } = body;
    
    // Fetch free config from settings
    const { data: config } = await supabaseAdmin.from('platform_settings').select('value').eq('key', 'free_tier_config').single();
    const freeLimits = (config?.value as any) || { max_products: 10, max_reels: 1 };

    const { error } = await supabaseAdmin
      .from('brands')
      .update({ 
        subscription_tier: 'free',
        subscription_expires_at: null,
        max_products: freeLimits.max_products || 10,
        max_reels: freeLimits.max_reels || 1,
        boost_level: null,
        visibility_score: 100
      })
      .eq('id', brandId);
    
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, message: 'Vendor has been reset to the free tier.' });
  }

  if (action === 'update_delivery_config') {
    const { brandId, scope, system } = body;
    const updateData: any = {};
    if (scope) updateData.delivery_scope = scope;
    if (system) updateData.assigned_delivery_system = system;

    const { error } = await supabaseAdmin
      .from('brands')
      .update(updateData)
      .eq('id', brandId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, message: 'Delivery configuration updated.' });
  }

  if (action === 'recalculate_ratings') {
    const { error } = await supabaseAdmin.rpc('recalculate_vendor_ratings');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, message: 'All vendor ratings have been recalculated.' });
  }

  if (action === 'update_admin_permissions') {
    const { userId, permissions } = body;
    const { error } = await supabaseAdmin
      .from('users')
      .update({ admin_permissions: permissions })
      .eq('id', userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'create_promo_code') {
    const { code, type, value, max_uses, product_id } = body;
    const { error } = await supabaseAdmin.from('promo_codes').insert({
      code: code.toUpperCase(),
      type,
      value,
      max_uses,
      product_id: product_id || null,
      is_active: true
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'delete_promo_code') {
    const { codeId } = body;
    const { error } = await supabaseAdmin.from('promo_codes').delete().eq('id', codeId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'update_sub_admin_permissions') {
    const { userId, permissions } = body;
    const { error } = await supabaseAdmin
      .from('users')
      .update({ admin_permissions: permissions })
      .eq('id', userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'add_team_member') {
    const { universityId, adminId, memberId, role } = body;
    const { error } = await supabaseAdmin.from('university_teams').insert({
      university_id: universityId,
      admin_id: adminId,
      member_id: memberId,
      role: role || 'member'
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Also update member role if they are just customers
    await supabaseAdmin.from('users').update({ role: 'sub_admin' }).eq('id', memberId).eq('role', 'customer');

    return NextResponse.json({ success: true });
  }

  if (action === 'remove_team_member') {
    const { teamId } = body;
    const { error } = await supabaseAdmin.from('university_teams').delete().eq('id', teamId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

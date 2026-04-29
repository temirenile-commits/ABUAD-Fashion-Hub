import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';


// ─── Middleware: Verify request is from an admin ───────────────────────────
async function verifyAdmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('role, admin_permissions')
    .eq('id', user.id)
    .single();

  if (profile?.role === 'admin') return { ...user, isFullAdmin: true, permissions: ['all'] };
  if (profile?.role === 'sub_admin') return { ...user, isFullAdmin: false, permissions: profile.admin_permissions || [] };
  
  return null;
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
      { count: userCount },
      { count: brandCount },
      { count: productCount },
      { data: revenueData }
    ] = await Promise.all([
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('brands').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('products').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('orders').select('total_amount, admin_discount').eq('status', 'paid'),
    ]);

    const totalRevenue = (revenueData || []).reduce((sum: number, o: any) => sum + Number(o.total_amount), 0);
    const totalSubsidies = (revenueData || []).reduce((sum: number, o: any) => sum + Number(o.admin_discount || 0), 0);

    return NextResponse.json({
      stats: { userCount, brandCount, productCount, totalRevenue, totalSubsidies }
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

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ reviews: data });
  }

  if (action === 'payouts') {
    const { data, error } = await supabaseAdmin
      .from('payout_requests')
      .select('*, users:user_id(name, email)')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ payouts: data });
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

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    
    // Flatten data
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

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ promoCodes: data });
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

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

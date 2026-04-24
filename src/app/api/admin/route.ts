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

  if (action === 'delete_user') {
    const { userId } = body;
    // Attempt to delete from public.users first
    const { error: profileError } = await supabaseAdmin.from('users').delete().eq('id', userId);
    
    if (profileError) {
      if (profileError.message.includes('foreign key constraint')) {
        return NextResponse.json({ error: 'User has active dependencies (orders/brands). Disable user instead of deleting.' }, { status: 400 });
      }
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }
    
    // Then delete from auth
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
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
      .upsert({ key, value, updated_at: new Date().toISOString() });
    
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
    
    let maxProducts = 10;
    let maxReels = 1;

    if (tierId === 'half') {
      maxProducts = 50;
      maxReels = 5;
    } else if (tierId === 'full') {
      maxProducts = 100000;
      maxReels = 100000;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    const { error } = await supabaseAdmin
      .from('brands')
      .update({ 
        subscription_tier: tierId, 
        subscription_expires_at: expiresAt.toISOString(),
        max_products: maxProducts,
        max_reels: maxReels
      })
      .eq('id', brandId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (action === 'activate_boost') {
    const { brandId, boostId } = body;
    
    let visibilityBoost = 50; // rodeo
    let durationDays = 7;

    if (boostId === 'nitro') {
      visibilityBoost = 150;
      durationDays = 14;
    }
    if (boostId === 'apex') {
      visibilityBoost = 500;
      durationDays = 30;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);
    
    const { error } = await supabaseAdmin
      .from('brands')
      .update({ 
        boost_level: boostId,
        boost_expires_at: expiresAt.toISOString(),
        visibility_score: 100 + visibilityBoost 
      })
      .eq('id', brandId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }



  if (action === 'send_notification') {
    const { title, content, target, userId: targetUserId } = body;

    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
    }

    if (target === 'all') {
      // Broadcast to all users — fetch all user IDs and insert for each
      const { data: allUsers } = await supabaseAdmin.from('users').select('id');
      if (allUsers && allUsers.length > 0) {
        const rows = allUsers.map((u: any) => ({ user_id: u.id, title, content, is_read: false }));
        const { error } = await supabaseAdmin.from('notifications').insert(rows);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, sent: allUsers?.length || 0 });
    }

    if (target === 'specific' && targetUserId) {
      const { error } = await supabaseAdmin.from('notifications').insert({
        user_id: targetUserId,
        title,
        content,
        is_read: false,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, sent: 1 });
    }

    return NextResponse.json({ error: 'Invalid target. Use "all" or "specific" with a userId.' }, { status: 400 });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

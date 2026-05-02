import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, universityId } = body;

    // Verify user is part of the support team for this university
    const { data: teamCheck } = await supabaseAdmin
      .from('university_teams')
      .select('role')
      .eq('university_id', universityId)
      .eq('member_id', user.id)
      .single();

    const { data: userProfile } = await supabaseAdmin.from('users').select('role').eq('id', user.id).single();

    const isSuperAdmin = userProfile?.role === 'admin';
    const isSupportHead = teamCheck?.role === 'User Support' || teamCheck?.role === 'Campus Admin' || isSuperAdmin;
    const isSupportAgent = isSupportHead || teamCheck?.role === 'customer_support_agent';

    if (!isSupportAgent) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Not a support agent.' }, { status: 403 });
    }

    if (action === 'get_dashboard_data') {
      // Support Agents get read-only access to recent orders, basic customer info, and vendors
      const [ordersRes, vendorsRes, customersRes] = await Promise.all([
        supabaseAdmin.from('orders').select('*, users:user_id(name, email, phone), brands:brand_id(name, phone)').order('created_at', { ascending: false }).limit(100),
        supabaseAdmin.from('brands').select('id, name, whatsapp_number, users:user_id(name, email)').eq('university_id', universityId),
        supabaseAdmin.from('users').select('id, name, email, phone, status').eq('university_id', universityId).limit(200)
      ]);
      
      return NextResponse.json({ 
        success: true, 
        orders: ordersRes.data || [], 
        vendors: vendorsRes.data || [], 
        customers: customersRes.data || [] 
      });
    }

    if (action === 'get_settings') {
      const { data: uniSettings } = await supabaseAdmin.from('platform_settings').select('*').eq('key', `uni_config_${universityId}`).single();
      const config = uniSettings?.value || {};
      
      const { data: teamData } = await supabaseAdmin.from('university_teams')
        .select('*, member:member_id(name, email)')
        .eq('university_id', universityId)
        .in('role', ['User Support', 'customer_support_agent']);

      return NextResponse.json({ 
        success: true, 
        supportNumbers: config.support_numbers || [],
        team: teamData || []
      });
    }

    // --- ACTIONS BELOW REQUIRE HEAD PRIVILEGES ---
    if (!isSupportHead) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Requires Support Head privileges.' }, { status: 403 });
    }

    if (action === 'update_numbers') {
      const { numbers } = body;
      const key = `uni_config_${universityId}`;
      const { data: current } = await supabaseAdmin.from('platform_settings').select('value').eq('key', key).single();
      const nextConfig = { ...(current?.value || {}), support_numbers: numbers };

      const { error } = await supabaseAdmin.from('platform_settings').upsert({ key, value: nextConfig });
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'add_agent') {
      const { email } = body;
      // find user
      const { data: targetUser } = await supabaseAdmin.from('users').select('id').eq('email', email).single();
      if (!targetUser) return NextResponse.json({ success: false, error: 'User not found' });

      // check if already in team
      const { data: existing } = await supabaseAdmin.from('university_teams').select('id').eq('university_id', universityId).eq('member_id', targetUser.id).single();
      if (existing) return NextResponse.json({ success: false, error: 'User is already a team member' });

      const { error } = await supabaseAdmin.from('university_teams').insert({
        university_id: universityId,
        admin_id: user.id,
        member_id: targetUser.id,
        role: 'customer_support_agent',
        permissions: ['support']
      });

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'remove_agent') {
      const { teamId } = body;
      // verify we only remove agents
      const { data: targetTeam } = await supabaseAdmin.from('university_teams').select('role').eq('id', teamId).single();
      if (targetTeam?.role !== 'customer_support_agent') {
         return NextResponse.json({ success: false, error: 'Cannot remove non-support agents' }, { status: 403 });
      }

      const { error } = await supabaseAdmin.from('university_teams').delete().eq('id', teamId);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  try {
    const { brandId, ownerId, message } = await req.json();

    // 1. Verify ownership & Plan
    const { data: brand, error: brandError } = await supabaseAdmin
      .from('brands')
      .select('subscription_tier, name')
      .eq('id', brandId)
      .eq('owner_id', ownerId)
      .single();

    if (brandError || !brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    if (brand.subscription_tier === 'quarter') {
      return NextResponse.json({ error: 'Upgrade to Half Power or higher to nudge followers!' }, { status: 403 });
    }

    // 2. Fetch followers
    const { data: followers, error: followError } = await supabaseAdmin
      .from('follows')
      .select('follower_id')
      .eq('brand_id', brandId);

    if (followError) throw followError;
    if (!followers || followers.length === 0) {
      return NextResponse.json({ error: 'You have no followers to notify yet.' }, { status: 400 });
    }

    // 3. Create Notifications
    const notifications = followers.map(f => ({
      user_id: f.follower_id,
      title: `${brand.name} has a new update!`,
      message: message || "Check out our latest arrivals and style updates on campus!",
      type: 'brand_update',
      metadata: JSON.stringify({ brandId })
    }));

    const { error: notifError } = await supabaseAdmin
      .from('notifications')
      .insert(notifications);

    if (notifError) throw notifError;

    return NextResponse.json({ success: true, count: followers.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

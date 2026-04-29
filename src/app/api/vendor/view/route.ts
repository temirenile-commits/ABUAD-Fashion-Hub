import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  try {
    const { brandId } = await req.json();
    if (!brandId) return NextResponse.json({ error: 'Missing brandId' }, { status: 400 });

    // Call RPC to increment profile views safely, or just update using RPC
    // Supabase JS doesn't have a direct atomic increment without RPC, so we fetch and update
    // But since this is a fast tracking route, we can just use the admin client
    const { data: brand } = await supabaseAdmin.from('brands').select('profile_views').eq('id', brandId).single();
    const currentViews = brand?.profile_views || 0;

    await supabaseAdmin.from('brands').update({ profile_views: currentViews + 1 }).eq('id', brandId);

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  try {
    const { userId, brandId, action } = await req.json();

    if (!userId || !brandId || !action) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    if (action === 'follow') {
      const { error } = await supabaseAdmin
        .from('follows')
        .insert({ follower_id: userId, brand_id: brandId });
      
      if (error && error.code !== '23505') throw error; // Ignore duplicate follows
    } else {
      const { error } = await supabaseAdmin
        .from('follows')
        .delete()
        .eq('follower_id', userId)
        .eq('brand_id', brandId);
      
      if (error) throw error;
    }

    // Update followers count in brands (Atomic increment)
    // For simplicity, we'll just recount
    const { count } = await supabaseAdmin
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('brand_id', brandId);

    await supabaseAdmin
      .from('brands')
      .update({ followers_count: count || 0 })
      .eq('id', brandId);

    return NextResponse.json({ success: true, count: count || 0 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

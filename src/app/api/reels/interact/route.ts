import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, reel_id, user_id, content } = body;

    if (!action || !reel_id) {
      return NextResponse.json({ error: 'action and reel_id are required' }, { status: 400 });
    }

    if (action === 'like') {
      if (!user_id) return NextResponse.json({ error: 'user_id required for liking' }, { status: 400 });

      // Check if already liked
      const { data: existing } = await supabaseAdmin
        .from('reel_likes')
        .select('id')
        .eq('reel_id', reel_id)
        .eq('user_id', user_id)
        .single();

      if (existing) {
        // Unlike
        await supabaseAdmin.from('reel_likes').delete().eq('id', existing.id);
        try {
          await supabaseAdmin.rpc('decrement_reel_likes', { reel_uuid: reel_id });
        } catch (e) {
          // ignore RPC if missing
        }
        return NextResponse.json({ success: true, liked: false });
      } else {
        // Like
        await supabaseAdmin.from('reel_likes').insert({ reel_id, user_id });
        try {
          await supabaseAdmin.rpc('increment_reel_likes', { reel_uuid: reel_id });
        } catch (e) {
          // ignore RPC if missing
        }
        return NextResponse.json({ success: true, liked: true });
      }
    }

    if (action === 'comment') {
      if (!user_id || !content) {
        return NextResponse.json({ error: 'user_id and content required for commenting' }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin
        .from('reel_comments')
        .insert({ reel_id, user_id, content })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, comment: data });
    }

    if (action === 'view') {
      await supabaseAdmin.from('reel_views').insert({ reel_id, user_id: user_id || null });
      try {
        await supabaseAdmin.rpc('increment_reel_views', { reel_uuid: reel_id });
      } catch (e) {
        // ignore RPC if missing
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('Error in reel interaction API:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

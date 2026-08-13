import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getAuthenticatedUser } from '@/lib/server-auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, reel_id, content } = body;

    if (!action || !reel_id) {
      return NextResponse.json({ error: 'action and reel_id are required' }, { status: 400 });
    }

    const userId = user.id;

    if (action === 'like') {
      const { data: existing } = await supabaseAdmin
        .from('reel_likes')
        .select('id')
        .eq('reel_id', reel_id)
        .eq('user_id', userId)
        .single();

      if (existing) {
        await supabaseAdmin.from('reel_likes').delete().eq('id', existing.id);
        return NextResponse.json({ success: true, liked: false });
      } else {
        await supabaseAdmin.from('reel_likes').insert({ reel_id, user_id: userId });
        return NextResponse.json({ success: true, liked: true });
      }
    }

    if (action === 'comment') {
      if (!content) {
        return NextResponse.json({ error: 'content required for commenting' }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin
        .from('reel_comments')
        .insert({ reel_id, user_id: userId, content })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, comment: data });
    }

    if (action === 'view') {
      await supabaseAdmin.from('reel_views').insert({ reel_id, user_id: userId });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('Error in reel interaction API:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

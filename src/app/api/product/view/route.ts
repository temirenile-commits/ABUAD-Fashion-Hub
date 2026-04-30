import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  try {
    const { productId } = await req.json();
    if (!productId) return NextResponse.json({ error: 'Missing productId' }, { status: 400 });

    // Atomic increment using RPC is better, but since it might not exist yet, 
    // we fetch and update using the admin client.
    const { data: product } = await supabaseAdmin
      .from('products')
      .select('views_count')
      .eq('id', productId)
      .single();

    const currentViews = product?.views_count || 0;

    const { error } = await supabaseAdmin
      .from('products')
      .update({ views_count: currentViews + 1 })
      .eq('id', productId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('[PRODUCT VIEW API] Error:', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

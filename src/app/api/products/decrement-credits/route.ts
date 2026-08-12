import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

async function getAuthenticatedUser(req: Request) {
  const authorization = req.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;

  const token = authorization.slice('Bearer '.length).trim();
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { brandId } = await req.json();
    if (!brandId) return NextResponse.json({ error: 'brandId is required' }, { status: 400 });

    const { data: brand, error: brandError } = await supabaseAdmin
      .from('brands')
      .select('id, owner_id')
      .eq('id', brandId)
      .maybeSingle();

    if (brandError) throw brandError;
    if (!brand || brand.owner_id !== user.id) {
      return NextResponse.json({ error: 'You do not own this vendor account' }, { status: 403 });
    }

    const { error } = await supabaseAdmin.rpc('decrement_listing_credits', {
      p_brand_id: brandId,
    });

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to decrement listing credits';
    console.error('[LISTING CREDITS]', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

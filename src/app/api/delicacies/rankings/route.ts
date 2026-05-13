import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const universityId = searchParams.get('universityId');
    const weekStart = searchParams.get('weekStart'); // ISO date string e.g. "2026-05-12"

    let query = supabaseAdmin
      .from('delicacy_vendor_rankings')
      .select(`
        id, rank, score, badge, orders_completed,
        avg_rating, complaints, reward_amount, week_start,
        brand_id,
        brands (
          id, name, logo_url, avg_rating, university_id
        )
      `)
      .order('rank', { ascending: true })
      .limit(20);

    if (universityId) query = query.eq('university_id', universityId);
    if (weekStart) query = query.eq('week_start', weekStart);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ rankings: data || [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

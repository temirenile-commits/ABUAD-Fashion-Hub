import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawUniversityId = searchParams.get('universityId');
    const universityId = rawUniversityId && rawUniversityId !== 'null' && rawUniversityId !== 'undefined' ? rawUniversityId : null;
    const weekStart = searchParams.get('weekStart');
    const type = searchParams.get('type') || 'vendors';

    if (type === 'products') {
      let query = supabaseAdmin
        .from('products')
        .select(`
          id, title, price, sold, weekly_sold, avg_rating:rating, media_urls, award_history,
          brands:brands!products_brand_id_fkey ( id, name, logo_url, university_id )
        `)
        .eq('product_section', 'delicacies')
        .order('weekly_sold', { ascending: false })
        .limit(20);

      query = universityId
        ? query.eq('university_id', universityId)
        : query.or('university_id.is.null,visibility_type.eq.global,visibility_type.is.null');

      const { data, error } = await query;
      if (error) throw error;
      return NextResponse.json({ rankings: data || [] });
    }

    if (type === 'all_vendors') {
      let query = supabaseAdmin
        .from('brands')
        .select('id, name, logo_url, avg_rating, description')
        .eq('marketplace_type', 'delicacies');

      query = universityId ? query.eq('university_id', universityId) : query.is('university_id', null);
      const { data, error } = await query.order('name', { ascending: true });
      if (error) throw error;
      return NextResponse.json({ vendors: data || [] });
    }

    let query = supabaseAdmin
      .from('delicacy_vendor_rankings')
      .select(`
        id, rank, score, badge, orders_completed,
        avg_rating, complaints, reward_amount, week_start,
        brand_id,
        brands:brands!delicacy_vendor_rankings_brand_id_fkey (
          id, name, logo_url, avg_rating, university_id
        )
      `)
      .order('rank', { ascending: true })
      .limit(10);

    query = universityId ? query.eq('university_id', universityId) : query.is('university_id', null);
    if (weekStart) query = query.eq('week_start', weekStart);

    const { data, error } = await query;

    if (!error && data && data.length > 0) {
      return NextResponse.json({ rankings: data });
    }

    // Fallback: real-time rankings scoped to the same valid university/null scope.
    let fallbackQuery = supabaseAdmin
      .from('brands')
      .select('id, name, logo_url, avg_rating, weekly_orders, award_history, university_id')
      .eq('marketplace_type', 'delicacies')
      .order('weekly_orders', { ascending: false })
      .limit(10);
    fallbackQuery = universityId ? fallbackQuery.eq('university_id', universityId) : fallbackQuery.is('university_id', null);

    const { data: realTime, error: rtError } = await fallbackQuery;
    if (rtError) throw rtError;

    const rankings = (realTime || []).map((vendor, index) => ({
      id: vendor.id,
      rank: index + 1,
      score: (vendor.weekly_orders || 0) * 10 + (vendor.avg_rating || 0) * 5,
      avg_rating: vendor.avg_rating || 0,
      orders_completed: vendor.weekly_orders || 0,
      award_history: vendor.award_history || [],
      brands: vendor,
    })).sort((a, b) => b.score - a.score);

    return NextResponse.json({ rankings });
  } catch (error: unknown) {
    const typed = error as any;
    console.error('[DELICACIES RANKINGS]', {
      code: typed?.code,
      message: typed?.message || 'Server error',
      details: typed?.details,
      hint: typed?.hint,
    });
    return NextResponse.json({
      error: typed?.message || 'Server error',
      code: typed?.code,
      details: typed?.details,
      hint: typed?.hint,
    }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Weekly cron — runs every Monday midnight
// Scores all delicacies vendors and stores rankings + disburses rewards
export async function GET() {
  try {
    // Week window: last 7 days
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setHours(0, 0, 0, 0);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 7);
    const weekStartStr = weekStart.toISOString().split('T')[0];

    // 1. Fetch global delicacies commission rate
    const { data: settings } = await supabaseAdmin
      .from('platform_settings')
      .select('value')
      .eq('key', 'delicacies_commission_rate')
      .single();

    const commissionRate = Number((settings?.value as Record<string, unknown>)?.rate || 0) / 100;

    // 2. Fetch all approved delicacies brands
    const { data: brands, error: brandsError } = await supabaseAdmin
      .from('brands')
      .select('id, university_id, name')
      .eq('marketplace_type', 'delicacies')
      .eq('delicacies_approval_status', 'approved');

    if (brandsError) throw brandsError;
    if (!brands || brands.length === 0) {
      return NextResponse.json({ message: 'No delicacies vendors to rank' });
    }

    // 3. For each brand — calculate score
    const rankingInserts: Record<string, unknown>[] = [];
    const poolUpdates: Record<string, number> = {}; // universityId -> commission earned

    for (const brand of brands) {
      // Orders completed this week
      const { count: ordersCompleted } = await supabaseAdmin
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brand.id)
        .eq('status', 'delivered')
        .gte('created_at', weekStart.toISOString())
        .lt('created_at', weekEnd.toISOString());

      // Average rating from reviews this week
      const { data: reviews } = await supabaseAdmin
        .from('product_reviews')
        .select('rating')
        .eq('brand_id', brand.id)
        .gte('created_at', weekStart.toISOString());

      const avgRating = reviews && reviews.length > 0
        ? reviews.reduce((s, r) => s + Number(r.rating), 0) / reviews.length
        : 0;

      // Complaints this week
      const { count: complaints } = await supabaseAdmin
        .from('support_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brand.id)
        .gte('created_at', weekStart.toISOString());

      // Revenue for reward pool calculation
      const { data: revenue } = await supabaseAdmin
        .from('orders')
        .select('total_amount')
        .eq('brand_id', brand.id)
        .eq('status', 'delivered')
        .gte('created_at', weekStart.toISOString());

      const totalRevenue = (revenue || []).reduce((s, o) => s + Number(o.total_amount), 0);
      const commission = totalRevenue * commissionRate;

      // Accumulate per university pool
      if (brand.university_id) {
        poolUpdates[brand.university_id] = (poolUpdates[brand.university_id] || 0) + commission;
      }

      // Scoring formula: weighted average
      const completionScore = Math.min(100, (ordersCompleted || 0) * 2); // 2pts per order, max 100
      const ratingScore = avgRating * 20; // out of 100
      const complaintPenalty = Math.min(50, (complaints || 0) * 5);
      const score = (ratingScore * 0.4) + (completionScore * 0.4) - (complaintPenalty * 0.2);

      rankingInserts.push({
        brand_id: brand.id,
        university_id: brand.university_id,
        week_start: weekStartStr,
        score: Math.max(0, Math.round(score * 100) / 100),
        orders_completed: ordersCompleted || 0,
        avg_rating: Math.round(avgRating * 100) / 100,
        complaints: complaints || 0,
        reward_amount: 0, // filled in below after ranking
      });
    }

    // 4. Sort by university and assign ranks
    const byUniversity: Record<string, typeof rankingInserts> = {};
    for (const r of rankingInserts) {
      const uid = r.university_id as string;
      if (!byUniversity[uid]) byUniversity[uid] = [];
      byUniversity[uid].push(r);
    }

    const REWARD_SHARES = [0.5, 0.3, 0.2]; // Gold, Silver, Bronze get 50/30/20% of pool
    const BADGES = ['gold', 'silver', 'bronze'];

    for (const [uid, group] of Object.entries(byUniversity)) {
      group.sort((a, b) => Number(b.score) - Number(a.score));
      const pool = poolUpdates[uid] || 0;
      const rewardPool = pool * 0.6; // 60% of commission goes to vendor rewards

      group.forEach((r, i) => {
        r.rank = i + 1;
        if (i < 3) {
          r.badge = BADGES[i];
          r.reward_amount = Math.round(rewardPool * REWARD_SHARES[i] * 100) / 100;
        }
      });

      // Upsert pool record
      await supabaseAdmin
        .from('delicacy_reward_pool')
        .upsert({
          university_id: uid,
          week_start: weekStartStr,
          total_collected: Math.round(pool * 100) / 100,
          total_disbursed: Math.round(rewardPool * 100) / 100,
          operational_reserve: Math.round((pool - rewardPool) * 100) / 100,
        }, { onConflict: 'university_id,week_start' });
    }

    // 5. Upsert all rankings
    const { error: insertError } = await supabaseAdmin
      .from('delicacy_vendor_rankings')
      .upsert(rankingInserts, { onConflict: 'brand_id,university_id,week_start' });

    if (insertError) throw insertError;

    return NextResponse.json({
      message: `Ranked ${rankingInserts.length} vendors across ${Object.keys(byUniversity).length} universities`,
      week: weekStartStr,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server error';
    console.error('Delicacy rankings cron error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

'use client';
import { useEffect, useState } from 'react';
import { Trophy, Star, ArrowLeft, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface RankEntry {
  id: string;
  rank: number;
  badge?: string;
  score: number;
  avg_rating: number;
  orders_completed: number;
  complaints: number;
  reward_amount: number;
  week_start: string;
  brands?: { id?: string; name?: string; logo_url?: string; university_id?: string };
}

const BADGE_CONFIG: Record<string, { emoji: string; color: string; bg: string }> = {
  gold:   { emoji: '🥇', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  silver: { emoji: '🥈', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
  bronze: { emoji: '🥉', color: '#b45309', bg: 'rgba(180,83,9,0.15)' },
};

export default function DelicaciesRankingsPage() {
  const [rankings, setRankings] = useState<RankEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [universityId, setUniversityId] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState('');

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from('users').select('university_id').eq('id', session.user.id).single();
        setUniversityId(profile?.university_id || null);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (!universityId) return;
    const fetchRankings = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/delicacies/rankings?universityId=${universityId}`);
        const data = await res.json();
        setRankings(data.rankings || []);
        if (data.rankings?.[0]?.week_start) {
          setWeekStart(new Date(data.rankings[0].week_start).toLocaleDateString('en-NG', { month: 'long', day: 'numeric' }));
        }
      } catch { /* silent */ }
      finally { setLoading(false); }
    };
    fetchRankings();
  }, [universityId]);

  const top3 = rankings.slice(0, 3);
  const rest = rankings.slice(3);

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-300)', paddingBottom: '3rem' }}>
      {/* ── HEADER ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1a0a00 0%, #0d0d0d 100%)',
        borderBottom: '1px solid rgba(245,158,11,0.15)',
        padding: '1.5rem 1rem'
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <Link href="/delicacies" style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            color: '#f59e0b', fontSize: '0.82rem', textDecoration: 'none', marginBottom: '1rem'
          }}>
            <ArrowLeft size={14} /> Back to Delicacies
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Trophy size={28} style={{ color: '#f59e0b' }} />
            <div>
              <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 900, color: '#fff' }}>
                Delicacies Leaderboard
              </h1>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>
                {weekStart ? `Week of ${weekStart} · Your University` : 'Loading rankings...'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '2rem auto', padding: '0 1rem' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} style={{ height: 80, borderRadius: 12, background: 'var(--bg-100)', animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
        ) : rankings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-400)' }}>
            <Trophy size={48} style={{ opacity: 0.2, margin: '0 auto 1rem', display: 'block' }} />
            <h3 style={{ color: 'var(--text-200)' }}>No Rankings Yet</h3>
            <p>Rankings are calculated every Monday based on the previous week&apos;s performance.</p>
          </div>
        ) : (
          <>
            {/* ── TOP 3 PODIUM ── */}
            {top3.length > 0 && (
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                {top3.map((r) => {
                  const brand = Array.isArray(r.brands) ? r.brands[0] : r.brands;
                  const cfg = r.badge ? BADGE_CONFIG[r.badge] : null;
                  return (
                    <div key={r.id} style={{
                      flex: 1, background: cfg?.bg || 'var(--bg-100)',
                      border: `1px solid ${cfg?.color || 'var(--border)'}30`,
                      borderRadius: 16, padding: '1.25rem', textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                        {r.badge ? BADGE_CONFIG[r.badge].emoji : `#${r.rank}`}
                      </div>
                      {brand?.logo_url ? (
                        <img src={brand.logo_url} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 0.5rem' }} />
                      ) : (
                        <div style={{
                          width: 48, height: 48, borderRadius: '50%', margin: '0 auto 0.5rem',
                          background: cfg?.color || '#f59e0b',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '1.2rem', fontWeight: 800, color: '#fff'
                        }}>
                          {brand?.name?.substring(0, 1) || '?'}
                        </div>
                      )}
                      <div style={{ fontWeight: 800, fontSize: '0.9rem', color: cfg?.color || 'var(--text-100)', marginBottom: 2 }}>
                        {brand?.name || 'Unknown'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: '0.72rem', color: '#facc15', marginBottom: '0.25rem' }}>
                        <Star size={11} fill="currentColor" /> {r.avg_rating.toFixed(1)}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-400)' }}>{r.orders_completed} orders</div>
                      {r.reward_amount > 0 && (
                        <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', fontWeight: 700, color: '#10b981' }}>
                          🎁 ₦{r.reward_amount.toLocaleString()} reward
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── REMAINING RANKINGS ── */}
            {rest.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <TrendingUp size={16} style={{ color: '#f59e0b' }} />
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Full Rankings</span>
                </div>
                {rest.map((r) => {
                  const brand = Array.isArray(r.brands) ? r.brands[0] : r.brands;
                  return (
                    <div key={r.id} style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      background: 'var(--bg-100)', border: '1px solid var(--border)',
                      borderRadius: 12, padding: '0.85rem 1rem'
                    }}>
                      <div style={{ width: 28, textAlign: 'center', fontWeight: 800, color: 'var(--text-400)', fontSize: '0.9rem' }}>
                        #{r.rank}
                      </div>
                      {brand?.logo_url ? (
                        <img src={brand.logo_url} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                          {brand?.name?.substring(0, 1) || '?'}
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{brand?.name || 'Unknown'}</div>
                        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.7rem', color: 'var(--text-400)', marginTop: 2 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#facc15' }}>
                            <Star size={10} fill="currentColor" /> {r.avg_rating.toFixed(1)}
                          </span>
                          <span>{r.orders_completed} orders</span>
                          {r.complaints > 0 && <span style={{ color: '#ef4444' }}>{r.complaints} complaints</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#f59e0b' }}>
                          {r.score.toFixed(1)} pts
                        </div>
                        {r.reward_amount > 0 && (
                          <div style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 700 }}>
                            🎁 ₦{r.reward_amount.toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

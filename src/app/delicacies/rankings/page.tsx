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
  const [activeTab, setActiveTab] = useState<'vendors' | 'products'>('vendors');
  const [rankings, setRankings] = useState<any[]>([]);
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
    const fetchRankings = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/delicacies/rankings?universityId=${universityId}&type=${activeTab}`);
        const data = await res.json();
        setRankings(data.rankings || []);
        if (activeTab === 'vendors' && data.rankings?.[0]?.week_start) {
          setWeekStart(new Date(data.rankings[0].week_start).toLocaleDateString('en-NG', { month: 'long', day: 'numeric' }));
        }
      } catch { /* silent */ }
      finally { setLoading(false); }
    };
    fetchRankings();
  }, [universityId, activeTab]);

  const top3 = activeTab === 'vendors' ? rankings.slice(0, 3) : [];
  const rest = activeTab === 'vendors' ? rankings.slice(3) : rankings;

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
                Delicacies Hub Leaderboard
              </h1>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>
                {activeTab === 'vendors' 
                  ? (weekStart ? `Top performing chefs week of ${weekStart}` : 'Real-time Top Chefs') 
                  : 'Most popular dishes on the system'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '2rem auto', padding: '0 1rem' }}>
        {/* TABS */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
           <button 
             onClick={() => setActiveTab('vendors')}
             style={{ 
               background: 'none', border: 'none', color: activeTab === 'vendors' ? '#f59e0b' : 'var(--text-400)', 
               fontWeight: 700, padding: '0.5rem 1rem', cursor: 'pointer', borderBottom: activeTab === 'vendors' ? '2px solid #f59e0b' : 'none'
             }}
           >
             👨‍🍳 Top Chefs
           </button>
           <button 
             onClick={() => setActiveTab('products')}
             style={{ 
               background: 'none', border: 'none', color: activeTab === 'products' ? '#f59e0b' : 'var(--text-400)', 
               fontWeight: 700, padding: '0.5rem 1rem', cursor: 'pointer', borderBottom: activeTab === 'products' ? '2px solid #f59e0b' : 'none'
             }}
           >
             🍲 Top Dishes
           </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} style={{ height: 80, borderRadius: 12, background: 'var(--bg-100)', animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
        ) : rankings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-400)' }}>
            <Trophy size={48} style={{ opacity: 0.2, margin: '0 auto 1rem', display: 'block' }} />
            <h3 style={{ color: 'var(--text-200)' }}>No Data Yet</h3>
            <p>We are still collecting sales data for this category.</p>
          </div>
        ) : (
          <>
            {/* ── TOP 3 PODIUM (Vendors Only) ── */}
            {activeTab === 'vendors' && top3.length > 0 && (
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
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-400)' }}>{r.orders_completed || 0} orders</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── REMAINING RANKINGS / PRODUCTS ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <TrendingUp size={16} style={{ color: '#f59e0b' }} />
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                    {activeTab === 'vendors' ? 'Full Rankings' : 'Top 10 Most Bought'}
                  </span>
                </div>
                {rest.map((r, i) => {
                  const brand = activeTab === 'vendors' ? (Array.isArray(r.brands) ? r.brands[0] : r.brands) : r.brands;
                  const isProduct = activeTab === 'products';
                  return (
                    <div key={r.id} style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      background: 'var(--bg-100)', border: '1px solid var(--border)',
                      borderRadius: 12, padding: '0.85rem 1rem'
                    }}>
                      <div style={{ width: 28, textAlign: 'center', fontWeight: 800, color: 'var(--text-400)', fontSize: '0.9rem' }}>
                        #{isProduct ? i + 1 : r.rank}
                      </div>
                      {isProduct ? (
                         <img src={r.media_urls?.[0] || '/placeholder.png'} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
                      ) : (
                        brand?.logo_url ? (
                            <img src={brand.logo_url} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                                {brand?.name?.substring(0, 1) || '?'}
                            </div>
                        )
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{isProduct ? r.title : (brand?.name || 'Unknown')}</div>
                        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.7rem', color: 'var(--text-400)', marginTop: 2 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#facc15' }}>
                            <Star size={10} fill="currentColor" /> {r.avg_rating?.toFixed(1) || '0.0'}
                          </span>
                          <span>{isProduct ? `${r.sold || 0} sold` : `${r.orders_completed || 0} orders`}</span>
                          {isProduct && <span style={{ color: '#10b981', fontWeight: 700 }}>₦{r.price?.toLocaleString()}</span>}
                        </div>
                      </div>
                      {!isProduct && r.score && (
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#f59e0b' }}>
                            {r.score.toFixed(1)} pts
                            </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
          </>
        )}
      </div>
    </main>
  );
}

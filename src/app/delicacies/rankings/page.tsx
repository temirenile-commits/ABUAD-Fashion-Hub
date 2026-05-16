'use client';
import { useEffect, useState } from 'react';
import { Trophy, Star, ArrowLeft, TrendingUp, UtensilsCrossed } from 'lucide-react';
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
  const [allVendors, setAllVendors] = useState<any[]>([]);
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
        const [rankRes, allVendRes] = await Promise.all([
          fetch(`/api/delicacies/rankings?universityId=${universityId}&type=${activeTab}`),
          fetch(`/api/delicacies/rankings?type=all_vendors`)
        ]);
        const [rankData, allVendData] = await Promise.all([rankRes.json(), allVendRes.json()]);
        
        setRankings(rankData.rankings || []);
        setAllVendors(allVendData.vendors || []);

        if (activeTab === 'vendors' && rankData.rankings?.[0]?.week_start) {
          setWeekStart(new Date(rankData.rankings[0].week_start).toLocaleDateString('en-NG', { month: 'long', day: 'numeric' }));
        }
      } catch { /* silent */ }
      finally { setLoading(false); }
    };
    fetchRankings();
  }, [universityId, activeTab]);

  const top3 = activeTab === 'vendors' ? rankings.slice(0, 3) : [];
  const top10 = rankings.slice(0, 10);

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-300)', paddingBottom: '5rem' }}>
      {/* ── HEADER ── */}
      <div style={{
        background: 'linear-gradient(135deg, #1a0a00 0%, #0d0d0d 100%)',
        borderBottom: '1px solid rgba(245,158,11,0.15)',
        padding: '2.5rem 1rem'
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <Link href="/delicacies" style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            color: '#f59e0b', fontSize: '0.85rem', textDecoration: 'none', marginBottom: '1.5rem'
          }}>
            <ArrowLeft size={16} /> Back to Delicacies
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
                width: 64, height: 64, borderRadius: 16, background: 'rgba(245,158,11,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
                <Trophy size={36} style={{ color: '#f59e0b' }} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 900, color: '#fff' }}>
                Delicacies Hall of Fame
              </h1>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)' }}>
                {activeTab === 'vendors' 
                  ? (weekStart ? `Top performing chefs for the week of ${weekStart}` : 'Real-time performance rankings') 
                  : 'The most ordered items on campus this week'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '2rem auto', padding: '0 1rem' }}>
        {/* TABS */}
        <div style={{ display: 'flex', gap: '2rem', marginBottom: '2.5rem', borderBottom: '1px solid var(--border)' }}>
           <button 
             onClick={() => setActiveTab('vendors')}
             style={{ 
               background: 'none', border: 'none', color: activeTab === 'vendors' ? '#f59e0b' : 'var(--text-400)', 
               fontWeight: 800, padding: '1rem 0', cursor: 'pointer', fontSize: '1rem',
               borderBottom: activeTab === 'vendors' ? '3px solid #f59e0b' : '3px solid transparent',
               transition: 'all 0.2s'
             }}
           >
             👨‍🍳 Top Chefs
           </button>
           <button 
             onClick={() => setActiveTab('products')}
             style={{ 
               background: 'none', border: 'none', color: activeTab === 'products' ? '#f59e0b' : 'var(--text-400)', 
               fontWeight: 800, padding: '1rem 0', cursor: 'pointer', fontSize: '1rem',
               borderBottom: activeTab === 'products' ? '3px solid #f59e0b' : '3px solid transparent',
               transition: 'all 0.2s'
             }}
           >
             🍲 Top Dishes
           </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{ height: 80, borderRadius: 12, background: 'var(--bg-100)', animation: 'pulse 1.5s infinite' }} />
            ))}
          </div>
        ) : rankings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-400)' }}>
            <Trophy size={64} style={{ opacity: 0.1, margin: '0 auto 1.5rem', display: 'block' }} />
            <h2 style={{ color: 'var(--text-100)', margin: 0 }}>Hall of Fame Pending</h2>
            <p style={{ marginTop: '0.5rem' }}>We're still processing sales data for this week.</p>
          </div>
        ) : (
          <>
            {/* ── PODIUM FOR VENDORS ── */}
            {activeTab === 'vendors' && top3.length > 0 && (
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '2.5rem' }}>
                {top3.map((r) => {
                  const brand = Array.isArray(r.brands) ? r.brands[0] : r.brands;
                  const cfg = r.badge ? BADGE_CONFIG[r.badge] : BADGE_CONFIG.gold;
                  return (
                    <div key={r.id} style={{
                      flex: 1, background: 'var(--bg-100)',
                      border: `1px solid ${cfg.color}30`,
                      borderRadius: 20, padding: '1.5rem', textAlign: 'center',
                      position: 'relative', overflow: 'hidden',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
                    }}>
                      <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>
                        {r.badge ? BADGE_CONFIG[r.badge].emoji : (r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : '🥉')}
                      </div>
                      <div style={{ position: 'relative', width: 64, height: 64, margin: '0 auto 1rem' }}>
                        {brand?.logo_url ? (
                            <img src={brand.logo_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${cfg.color}` }} />
                        ) : (
                            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 900, color: '#fff' }}>
                                {brand?.name?.[0] || '?'}
                            </div>
                        )}
                      </div>
                      <div style={{ fontWeight: 900, fontSize: '1rem', color: 'var(--text-100)', marginBottom: 4 }}>
                        {brand?.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: '0.8rem', color: '#facc15', marginBottom: '0.5rem' }}>
                        <Star size={13} fill="currentColor" /> {r.avg_rating.toFixed(1)}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-400)', fontWeight: 600 }}>{r.orders_completed || 0} ORDERS</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── TOP 10 LIST (Both Tabs) ── */}
            <div style={{ marginBottom: '4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <TrendingUp size={20} style={{ color: '#f59e0b' }} />
                  <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Top 10 Performers</h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {top10.map((r, i) => {
                    const brand = activeTab === 'vendors' ? (Array.isArray(r.brands) ? r.brands[0] : r.brands) : r.brands;
                    const isProduct = activeTab === 'products';
                    return (
                      <div key={r.id} style={{
                        display: 'flex', alignItems: 'center', gap: '1rem',
                        background: 'var(--bg-100)', border: '1px solid var(--border)',
                        borderRadius: 16, padding: '1.25rem',
                        boxShadow: i < 3 ? '0 4px 12px rgba(245,158,11,0.05)' : 'none'
                      }}>
                        <div style={{ width: 32, textAlign: 'center', fontWeight: 900, color: i < 3 ? '#f59e0b' : 'var(--text-400)', fontSize: '1.1rem' }}>
                          #{isProduct ? i + 1 : r.rank}
                        </div>
                        {isProduct ? (
                            <img src={r.media_urls?.[0] || '/placeholder.png'} alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover' }} />
                        ) : (
                            <div style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                                {brand?.logo_url ? <img src={brand.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', background: 'var(--bg-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{brand?.name?.[0]}</div>}
                            </div>
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 800, fontSize: '1rem' }}>{isProduct ? r.title : brand?.name}</div>
                          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-400)', marginTop: 4 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#facc15', fontWeight: 700 }}>
                              <Star size={12} fill="currentColor" /> {r.avg_rating?.toFixed(1) || '0.0'}
                            </span>
                            <span>{isProduct ? `${r.sold || 0} Sold` : `${r.orders_completed || 0} Orders`}</span>
                            {isProduct && <span style={{ color: '#10b981', fontWeight: 800 }}>₦{r.price?.toLocaleString()}</span>}
                            {!isProduct && brand?.university_id === universityId && <span style={{ color: 'var(--primary)', fontVariant: 'small-caps' }}>Your Campus</span>}
                          </div>
                        </div>
                        {!isProduct && r.score && (
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 900, fontSize: '1rem', color: '#f59e0b' }}>{r.score.toFixed(0)}</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-400)', fontWeight: 700 }}>POINTS</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
            </div>

            {/* ── ALL DELICACY VENDORS DIRECTORY ── */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    <UtensilsCrossed size={20} style={{ color: '#94a3b8' }} />
                    <h2 style={{ fontSize: '1.2rem', margin: 0 }}>All Delicacy Stores</h2>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
                    {allVendors.map(v => (
                        <Link key={v.id} href={`/vendor/${v.id}`} style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            background: 'var(--bg-100)', border: '1px solid var(--border)',
                            borderRadius: 14, padding: '1rem', textDecoration: 'none', color: 'inherit',
                            transition: 'transform 0.2s'
                        }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                            <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                                {v.logo_url ? <img src={v.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', background: 'var(--bg-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>{v.name?.[0]}</div>}
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{v.name}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: '#facc15' }}>
                                    <Star size={10} fill="currentColor" /> {v.avg_rating?.toFixed(1) || '0.0'}
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

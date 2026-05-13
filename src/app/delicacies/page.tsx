'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  UtensilsCrossed, Star, ShoppingCart, Trophy,
  Search, ArrowRight, Clock, ChevronRight
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import BatchWindowTimer from '@/components/BatchWindowTimer';
import VendorAvailabilityTimer from '@/components/VendorAvailabilityTimer';
import styles from './page.module.css';

const CATEGORY_META: Record<string, { label: string; emoji: string }> = {
  snacks:     { label: 'Snacks',      emoji: '🍟' },
  drinks:     { label: 'Drinks',      emoji: '🥤' },
  pastries:   { label: 'Pastries',    emoji: '🥐' },
  provisions: { label: 'Provisions',  emoji: '🛒' },
  small_chops:{ label: 'Small Chops', emoji: '🍢' },
  beverages:  { label: 'Beverages',   emoji: '☕' },
  other:      { label: 'Other',       emoji: '🍽️' },
};

interface DelicacyProduct {
  id: string;
  title: string;
  description?: string;
  price: number;
  original_price?: number;
  image_url?: string;
  media_urls?: string[];
  stock_count: number;
  rating?: number;
  sales_count?: number;
  delicacy_category?: string;
  available_from?: string;
  brands?: {
    id?: string;
    name?: string;
    logo_url?: string;
    avg_rating?: number;
    is_available_now?: boolean;
    availability_start?: string;
    availability_end?: string;
  };
}

interface RankingEntry {
  rank: number;
  badge?: string;
  score: number;
  avg_rating: number;
  orders_completed: number;
  brands?: { name?: string; logo_url?: string };
}

const BADGE_CONFIG: Record<string, { emoji: string; color: string; label: string }> = {
  gold:   { emoji: '🥇', color: '#f59e0b', label: 'Gold' },
  silver: { emoji: '🥈', color: '#94a3b8', label: 'Silver' },
  bronze: { emoji: '🥉', color: '#b45309', label: 'Bronze' },
};

export default function DelicaciesPage() {
  const [products, setProducts] = useState<DelicacyProduct[]>([]);
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [universityId, setUniversityId] = useState<string | null>(null);
  const [billboards, setBillboards] = useState<any[]>([]);
  const [billboardIdx, setBillboardIdx] = useState(0);

  // Fetch user university
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from('users')
          .select('university_id')
          .eq('id', session.user.id)
          .single();
        setUniversityId(profile?.university_id || null);
      }
    };
    init();
  }, []);

  // Fetch products + rankings
  useEffect(() => {
    if (!universityId) return;
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [prodRes, rankRes, catRes, billRes] = await Promise.all([
          fetch(`/api/delicacies?universityId=${universityId}&limit=60`),
          fetch(`/api/delicacies/rankings?universityId=${universityId}`),
          fetch('/api/delicacies/categories'),
          fetch(`/api/delicacies/billboard?universityId=${universityId}`),
        ]);

        const [prodData, rankData, catData, billData] = await Promise.all([
          prodRes.json(), rankRes.json(), catRes.json(), billRes.json()
        ]);

        setProducts(prodData.products || []);
        setRankings(rankData.rankings || []);
        setCategories(catData.categories || []);
        setBillboards(billData.billboards || []);
      } catch { /* silent */ }
      finally { setLoading(false); }
    };
    fetchAll();
  }, [universityId]);

  // Billboard Auto-rotation
  useEffect(() => {
    if (billboards.length <= 1) return;
    const timer = setInterval(() => {
      setBillboardIdx(prev => (prev + 1) % billboards.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [billboards.length]);

  const filtered = useMemo(() => {
    let list = products;
    if (selectedCat !== 'all') list = list.filter(p => p.delicacy_category === selectedCat);
    if (search.trim()) list = list.filter(p =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      (Array.isArray(p.brands) ? p.brands[0] : p.brands)?.name?.toLowerCase().includes(search.toLowerCase())
    );
    return list;
  }, [products, selectedCat, search]);

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-300)' }}>
      {/* ── HERO BANNER ── */}
      <div className={styles.hero}>
        <div className={styles.heroGradient} />
        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <UtensilsCrossed size={14} /> CAMPUS EATS
          </div>
          <h1 className={styles.heroTitle}>MasterCart Delicacies</h1>
          <p className={styles.heroSubtitle}>
            Fresh snacks, drinks & campus favourites — delivered within your university
          </p>
          <div className={styles.searchBar}>
            <Search size={16} style={{ opacity: 0.5, flexShrink: 0 }} />
            <input
              placeholder="Search snacks, pastries, drinks..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={styles.searchInput}
            />
          </div>
        </div>
      </div>

      <div className={styles.container}>
        {/* ── PREMIUM BILLBOARD CAROUSEL ── */}
        {billboards.length > 0 && (
          <div className={styles.billboardWrap}>
            {billboards.map((bill, i) => (
              <div 
                key={bill.id} 
                className={`${styles.billboardSlide} ${i === billboardIdx ? styles.billboardSlideActive : ''}`}
              >
                <div className={styles.billboardContent}>
                  <div className={styles.billboardLabel}>
                    <Star size={12} fill="currentColor" /> Premium Feature
                  </div>
                  <h2 className={styles.billboardTitle}>
                    {bill.products?.title || bill.brands?.name || 'Delicacies Special'}
                  </h2>
                  <div className={styles.billboardMeta}>
                    <span className={styles.billboardPrice}>
                      ₦{Number(bill.products?.price || 0).toLocaleString()}
                    </span>
                    <span>By {bill.brands?.name}</span>
                  </div>
                  <Link 
                    href={bill.products?.id ? `/product/${bill.products.id}` : `/vendor/${bill.brands?.id}`}
                    className="btn btn-primary" 
                    style={{ marginTop: '1.5rem', background: '#f59e0b', border: 'none', borderRadius: '999px' }}
                  >
                    View Offer <ArrowRight size={16} />
                  </Link>
                </div>
                
                <div className={styles.billboardMedia}>
                  <img 
                    src={bill.products?.image_url || bill.products?.media_urls?.[0] || bill.brands?.logo_url || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800'} 
                    alt="" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              </div>
            ))}
            
            {billboards.length > 1 && (
              <div className={styles.billboardDots}>
                {billboards.map((_, i) => (
                  <div 
                    key={i} 
                    className={`${styles.billboardDot} ${i === billboardIdx ? styles.billboardDotActive : ''}`}
                    onClick={() => setBillboardIdx(i)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Fallback space if no billboards (Hidden Timer) */}
        {billboards.length === 0 && <div style={{ height: '1.5rem' }} />}

        {/* ── CATEGORY TABS ── */}
        <div className={styles.catTabs}>
          <button
            className={`${styles.catTab} ${selectedCat === 'all' ? styles.catTabActive : ''}`}
            onClick={() => setSelectedCat('all')}
          >
            🍽️ All
          </button>
          {categories.map(cat => {
            const meta = CATEGORY_META[cat] || { label: cat, emoji: '🍽️' };
            return (
              <button
                key={cat}
                className={`${styles.catTab} ${selectedCat === cat ? styles.catTabActive : ''}`}
                onClick={() => setSelectedCat(cat)}
              >
                {meta.emoji} {meta.label}
              </button>
            );
          })}
        </div>

        <div className={styles.layout}>
          {/* ── MAIN PRODUCT GRID ── */}
          <div className={styles.main}>
            {loading ? (
              <div className={styles.grid}>
                {[...Array(8)].map((_, i) => (
                  <div key={i} className={styles.skeletonCard} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className={styles.empty}>
                <span style={{ fontSize: '3rem' }}>🍽️</span>
                <h3>No delicacies found</h3>
                <p>Try a different category or check back later</p>
              </div>
            ) : (
              <div className={styles.grid}>
                {filtered.map(item => {
                  const brand = Array.isArray(item.brands) ? item.brands[0] : item.brands;
                  const img = item.image_url || item.media_urls?.[0];
                  const catMeta = CATEGORY_META[item.delicacy_category || 'other'];
                  const isOpen = brand?.is_available_now !== false;
                  const discount = item.original_price && item.original_price > item.price
                    ? Math.round(((item.original_price - item.price) / item.original_price) * 100)
                    : 0;

                  return (
                    <Link key={item.id} href={`/product/${item.id}`} className={styles.card}>
                      <div className={styles.cardImg}>
                        {img ? (
                          <img src={img} alt={item.title} className={styles.cardImgEl} />
                        ) : (
                          <div className={styles.cardImgPlaceholder}>{catMeta?.emoji || '🍽️'}</div>
                        )}
                        {discount > 0 && (
                          <span className={styles.discountBadge}>-{discount}%</span>
                        )}
                        <span className={`${styles.statusBadge} ${isOpen ? styles.open : styles.closed}`}>
                          <Clock size={9} />
                          {isOpen ? 'OPEN' : 'CLOSED'}
                        </span>
                      </div>
                      <div className={styles.cardBody}>
                        <div className={styles.cardCategory}>{catMeta?.emoji} {catMeta?.label}</div>
                        <div className={styles.cardTitle}>{item.title}</div>
                        <div className={styles.cardBrand}>{brand?.name}</div>
                        <VendorAvailabilityTimer
                          availabilityStart={brand?.availability_start}
                          availabilityEnd={brand?.availability_end}
                          isAvailableNow={brand?.is_available_now !== false}
                        />
                        <div className={styles.cardFooter}>
                          <div className={styles.cardPrice}>₦{Number(item.price).toLocaleString()}</div>
                          {item.rating && (
                            <span className={styles.cardRating}>
                              <Star size={11} fill="currentColor" />
                              {Number(item.rating).toFixed(1)}
                            </span>
                          )}
                        </div>
                        <button className={styles.addToCart}>
                          <ShoppingCart size={14} /> Add to Cart
                        </button>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── SIDEBAR: WEEKLY RANKINGS ── */}
          <aside className={styles.sidebar}>
            <div className={styles.rankingsCard}>
              <div className={styles.rankingsHeader}>
                <Trophy size={16} style={{ color: '#f59e0b' }} />
                <span>This Week&apos;s Top Vendors</span>
                <Link href="/delicacies/rankings" className={styles.rankingsLink}>
                  Full <ChevronRight size={12} />
                </Link>
              </div>
              {rankings.slice(0, 5).map((r, i) => {
                const brand = Array.isArray(r.brands) ? r.brands[0] : r.brands;
                const badge = r.badge ? BADGE_CONFIG[r.badge] : null;
                return (
                  <div key={i} className={styles.rankRow}>
                    <div className={styles.rankNum}>
                      {badge ? badge.emoji : `#${r.rank}`}
                    </div>
                    {brand?.logo_url ? (
                      <img src={brand.logo_url} alt="" className={styles.rankAvatar} />
                    ) : (
                      <div className={styles.rankAvatarFallback}>
                        {brand?.name?.substring(0, 1).toUpperCase() || '?'}
                      </div>
                    )}
                    <div className={styles.rankInfo}>
                      <div className={styles.rankName}>{brand?.name || 'Unknown'}</div>
                      <div className={styles.rankStats}>
                        <Star size={9} fill="#facc15" color="#facc15" /> {r.avg_rating?.toFixed(1)} · {r.orders_completed} orders
                      </div>
                    </div>
                  </div>
                );
              })}
              {rankings.length === 0 && (
                <p className={styles.noRankings}>Rankings update every Monday</p>
              )}
            </div>
          </aside>
        </div>

        {/* ── CTA: BECOME A DELICACIES VENDOR ── */}
        <div className={styles.vendorCta}>
          <span style={{ fontSize: '2rem' }}>🍳</span>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>Sell Your Campus Delicacies</div>
            <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Apply to become a MasterCart Delicacies vendor today</div>
          </div>
          <Link href="/onboarding?type=delicacies" className={styles.ctaBtn}>
            Apply Now <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </main>
  );
}

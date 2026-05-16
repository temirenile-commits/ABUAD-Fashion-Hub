'use client';
import { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  UtensilsCrossed, Star, ShoppingCart, Trophy,
  Search, ArrowRight, Clock
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import ShareProductButton from '@/components/ShareProductButton';
import styles from './page.module.css';

interface Category {
  id: string;
  label: string;
  emoji: string;
}

interface DelicacyProduct {
  id: string;
  title: string;
  price: number;
  original_price?: number;
  image_url?: string;
  media_urls?: string[];
  rating?: number;
  delicacy_category: string;
  available_from?: string;
  location_availability?: string;
  brands: any; // Can be object or array depending on join
}

interface RankingEntry {
  rank: number;
  brands: any;
  orders_completed: number;
  avg_rating: number;
  badge?: string;
}

const BADGE_CONFIG: Record<string, { label: string; emoji: string }> = {
  'top_chef': { label: 'Top Chef', emoji: '👨‍🍳' },
  'rising_star': { label: 'Rising Star', emoji: '🌟' },
  'speedy_cook': { label: 'Speedy Cook', emoji: '⚡' },
};

export default function DelicaciesPage() {
  const [products, setProducts] = useState<DelicacyProduct[]>([]);
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [universityId, setUniversityId] = useState<string | null>(null);
  const [userHostel, setUserHostel] = useState<string | null>(null);
  const [billboards, setBillboards] = useState<{id: string; image_url: string; brand_id: string}[]>([]);
  const [billboardIdx, setBillboardIdx] = useState(0);
  void billboardIdx; void setBillboardIdx; // Used by billboard auto-rotation below

  // Advanced Filters
  const [statusFilter, setStatusFilter] = useState<string>('all'); // all, available, preorder, top_rated
  const [useLocationFilter, setUseLocationFilter] = useState(false);
  const priceRange: [number, number] = [0, 10000]; // Static range (no UI slider currently)

  // Fetch user university
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from('users')
          .select('university_id, hostel')
          .eq('id', session.user.id)
          .single();
        setUniversityId(profile?.university_id || null);
        setUserHostel(profile?.hostel || null);
      }
    };
    init();
  }, []);

  // Fetch products + rankings + categories
  useEffect(() => {
    if (!universityId) return;
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [prodRes, rankRes, catRes, billRes] = await Promise.all([
          fetch(`/api/delicacies?universityId=${universityId}&limit=100`),
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
      } catch (err) { console.error('Fetch error:', err); }
      finally { setLoading(false); }
    };
    fetchAll();
  }, [universityId]);

  const [sharedProductId, setSharedProductId] = useState<string | null>(null);
  const hasSyncedParams = useRef(false);

  // Sync Search & Deep Link with URL
  useEffect(() => {
    if (hasSyncedParams.current) return;
    hasSyncedParams.current = true;

    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) setSearch(q);
    
    const pId = params.get('product');
    if (pId) setSharedProductId(pId);
  }, []);

  // Billboard Auto-rotation
  useEffect(() => {
    if (billboards.length <= 1) return;
    const timer = setInterval(() => {
      setBillboardIdx(prev => (prev + 1) % billboards.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [billboards.length]);

  const filtered = useMemo(() => {
    let list = [...products];
    
    // Deep Link Logic: If a product is shared, put it at the very top and highlight it
    if (sharedProductId) {
      const sharedItem = list.find(p => p.id === sharedProductId);
      if (sharedItem) {
        list = [sharedItem, ...list.filter(p => p.id !== sharedProductId)];
      }
    }

    // Category Filter
    if (selectedCat !== 'all' && !sharedProductId) {
       list = list.filter(p => p.delicacy_category === selectedCat);
    }
    
    // Search Filter
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(p =>
        p.title.toLowerCase().includes(s) ||
        (Array.isArray(p.brands) ? p.brands[0] : p.brands)?.name?.toLowerCase().includes(s)
      );
    }

    // Status Filters
    if (!sharedProductId) {
      if (statusFilter === 'available') {
        list = list.filter(p => (Array.isArray(p.brands) ? p.brands[0] : p.brands)?.is_available_now !== false);
      } else if (statusFilter === 'preorder') {
        list = list.filter(p => p.available_from);
      } else if (statusFilter === 'top_rated') {
        list = list.filter(p => (p.rating || 0) >= 4.5);
      }
    }

    // Location Filter (My Hostel) - COMBINABLE
    if (useLocationFilter && userHostel && !sharedProductId) {
       const h = userHostel.toLowerCase();
       list = list.filter(p => {
         const loc = (p.location_availability || '').toLowerCase();
         return loc.includes(h) || loc.includes('whole university') || loc === 'all';
       });
    }

    // Price Filter
    if (!sharedProductId) {
      list = list.filter(p => p.price >= priceRange[0] && p.price <= priceRange[1]);
    }

    return list;
  }, [products, selectedCat, search, statusFilter, useLocationFilter, userHostel, sharedProductId]);

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
            Snacks, Small Chops, Pastries & Provisions — strictly for campus cravings
          </p>
          <div className={styles.searchBar}>
            <Search size={16} style={{ opacity: 0.5, flexShrink: 0 }} />
            <input
              placeholder="Search delicacies..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={styles.searchInput}
            />
          </div>
        </div>
      </div>

      <div className={styles.container}>
        {/* ── FAST FILTERS & CATEGORIES ── */}
        <div className={styles.filterSection}>
          <div className={styles.fastFilters}>
            <button className={`${styles.filterBtn} ${statusFilter === 'all' && !useLocationFilter ? styles.filterBtnActive : ''}`} onClick={() => { setStatusFilter('all'); setUseLocationFilter(false); }}>All Items</button>
            
            {userHostel && (
              <button 
                className={`${styles.filterBtn} ${useLocationFilter ? styles.filterBtnActive : ''}`} 
                onClick={() => setUseLocationFilter(!useLocationFilter)}
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                📍 In {userHostel.split(' ')[0]}
              </button>
            )}

            <div style={{ width: '1px', height: '24px', background: 'var(--border)', margin: '0 8px' }} />

            <button className={`${styles.filterBtn} ${statusFilter === 'available' ? styles.filterBtnActive : ''}`} onClick={() => setStatusFilter('available')}>Available Now</button>
            <button className={`${styles.filterBtn} ${statusFilter === 'preorder' ? styles.filterBtnActive : ''}`} onClick={() => setStatusFilter('preorder')}>Preorders</button>
            <button className={`${styles.filterBtn} ${statusFilter === 'top_rated' ? styles.filterBtnActive : ''}`} onClick={() => setStatusFilter('top_rated')}>Top Rated</button>
          </div>

          <div className={styles.catTabs}>
            <button
              className={`${styles.catTab} ${selectedCat === 'all' ? styles.catTabActive : ''}`}
              onClick={() => setSelectedCat('all')}
            >
              🍽️ All
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                className={`${styles.catTab} ${selectedCat === cat.id ? styles.catTabActive : ''}`}
                onClick={() => setSelectedCat(cat.id)}
              >
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>
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
                <span style={{ fontSize: '3.5rem' }}>🍪</span>
                <h3>No delicacies match your search</h3>
                <p>Try different filters or browse all categories</p>
                <button onClick={() => { setSelectedCat('all'); setStatusFilter('all'); setUseLocationFilter(false); setSearch(''); }} className="btn btn-ghost" style={{ marginTop: '1rem' }}>Clear All Filters</button>
              </div>
            ) : (
              <div className={styles.grid}>
                {filtered.map(item => {
                  const brand = Array.isArray(item.brands) ? item.brands[0] : item.brands;
                  const img = item.image_url || item.media_urls?.[0];
                  const catMeta = categories.find(c => c.id === item.delicacy_category);
                  const isOpen = brand?.is_available_now !== false;
                  const discount = item.original_price && item.original_price > item.price
                    ? Math.round(((item.original_price - item.price) / item.original_price) * 100)
                    : 0;

                  return (
                    <Link 
                      key={item.id} 
                      href={`/product/${item.id}`} 
                      className={`${styles.card} ${item.id === sharedProductId ? styles.cardShared : ''}`}
                    >
                      {item.id === sharedProductId && (
                        <div className={styles.sharedBadge}>✨ Shared Selection</div>
                      )}
                      <div className={styles.cardImg}>
                        {img ? (
                          <img src={img} alt={item.title} className={styles.cardImgEl} />
                        ) : (
                          <div className={styles.cardImgPlaceholder}>{catMeta?.emoji || '🍽️'}</div>
                        )}
                        {discount > 0 && <span className={styles.discountBadge}>-{discount}%</span>}
                        <span className={`${styles.statusBadge} ${isOpen ? styles.open : styles.closed}`}>
                          <Clock size={9} />
                          {isOpen ? 'OPEN' : 'CLOSED'}
                        </span>
                        
                        <div 
                          className={styles.shareOverlay} 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                        >
                          <ShareProductButton 
                            productId={item.id} 
                            productTitle={item.title} 
                            className={styles.cardShareBtn}
                          />
                        </div>
                      </div>
                      <div className={styles.cardBody}>
                        <div className={styles.cardCategory}>{catMeta?.emoji || '🍽️'} {catMeta?.label || 'Delicacy'}</div>
                        <div className={styles.cardTitle}>{item.title}</div>
                        <div className={styles.cardBrand}>{brand?.name}</div>
                        <div className={styles.cardFooter}>
                          <div className={styles.cardPrice}>₦{Number(item.price).toLocaleString()}</div>
                          {item.rating && (
                            <span className={styles.cardRating}>
                              <Star size={11} fill="currentColor" />
                              {Number(item.rating).toFixed(1)}
                            </span>
                          )}
                        </div>
                        <button className={styles.addToCart} onClick={(e) => { e.preventDefault(); /* Cart logic */ }}>
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
                <span>Weekly Hall of Fame</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-400)', marginBottom: '1rem', padding: '0 0.5rem' }}>Top vendors awarded badges of honor & boosts.</p>
              {rankings.slice(0, 5).map((r, i) => {
                const brand = Array.isArray(r.brands) ? r.brands[0] : r.brands;
                const badge = r.badge ? BADGE_CONFIG[r.badge] : null;
                return (
                  <div key={i} className={styles.rankRow}>
                    <div className={styles.rankNum}>{badge ? badge.emoji : `#${r.rank}`}</div>
                    <div className={styles.rankAvatar}>
                      {brand?.logo_url ? <img src={brand.logo_url} alt="" /> : <span>{brand?.name?.[0]}</span>}
                    </div>
                    <div className={styles.rankInfo}>
                      <div className={styles.rankName}>{brand?.name}</div>
                      <div className={styles.rankStats}>{r.orders_completed} orders · {r.avg_rating?.toFixed(1)} ⭐</div>
                    </div>
                  </div>
                );
              })}
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

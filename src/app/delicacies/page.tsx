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
  cafeteria_ids?: string[];
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
  const [topDishes, setTopDishes] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [universityId, setUniversityId] = useState<string | null>(null);
  const [userHostel, setUserHostel] = useState<string | null>(null);
  const [billboards, setBillboards] = useState<{id: string; image_url: string; brand_id: string}[]>([]);
  const [billboardIdx, setBillboardIdx] = useState(0);
  void billboardIdx; void setBillboardIdx; // Used by billboard auto-rotation below

  // Cafeteria filter state
  const [cafeterias, setCafeterias] = useState<any[]>([]);
  const [selectedCafeteria, setSelectedCafeteria] = useState<string | null>(null);

  // Advanced Filters
  const [statusFilter, setStatusFilter] = useState<string>('all'); // all, available, preorder, top_rated
  const [useLocationFilter, setUseLocationFilter] = useState(false);

  // Price range filter
  const [priceMin, setPriceMin] = useState<string>('');
  const [priceMax, setPriceMax] = useState<string>('');

  const DEFAULT_UNIVERSITY_ID = '00000000-0000-0000-0000-000000000001';

  // Fetch user university
  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: profile } = await supabase
            .from('users')
            .select('university_id, hostel')
            .eq('id', session.user.id)
            .single();
          setUniversityId(profile?.university_id || DEFAULT_UNIVERSITY_ID);
          setUserHostel(profile?.hostel || null);
        } else {
          setUniversityId(DEFAULT_UNIVERSITY_ID);
        }
      } catch {
        setUniversityId(DEFAULT_UNIVERSITY_ID);
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
        const [prodRes, rankRes, dishesRes, catRes, billRes] = await Promise.all([
          fetch(`/api/delicacies?universityId=${universityId}&limit=100`),
          fetch(`/api/delicacies/rankings?universityId=${universityId}`),
          fetch(`/api/delicacies/rankings?universityId=${universityId}&type=products`),
          fetch('/api/delicacies/categories'),
          fetch(`/api/delicacies/billboard?universityId=${universityId}`),
        ]);

        const [prodData, rankData, dishesData, catData, billData] = await Promise.all([
          prodRes.json(), rankRes.json(), dishesRes.json(), catRes.json(), billRes.json()
        ]);

        setProducts(prodData.products || []);
        setRankings(rankData.rankings || []);
        setTopDishes(dishesData.rankings || []);
        setCategories(catData.categories || []);
        setBillboards(billData.billboards || []);

        // Fetch cafeterias for this university
        try {
          const cafRes = await fetch(`/api/university-admin?action=cafeterias&university_id=${universityId}`);
          const cafData = await cafRes.json();
          setCafeterias((cafData.cafeterias || []).filter((c: any) => c.is_active));
        } catch { /* cafeterias optional */ }
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

    // Cafeteria Filter
    if (selectedCafeteria && !sharedProductId) {
      list = list.filter(p => (p.cafeteria_ids || []).includes(selectedCafeteria));
    }

    // Price Filter
    if (!sharedProductId) {
      const min = priceMin ? Number(priceMin) : 0;
      const max = priceMax ? Number(priceMax) : Infinity;
      list = list.filter(p => p.price >= min && p.price <= max);
    }

    return list;
  }, [products, selectedCat, search, statusFilter, useLocationFilter, userHostel, sharedProductId, selectedCafeteria, priceMin, priceMax]);

  const matchingVendors = useMemo(() => {
    if (!search.trim()) return [];
    const s = search.toLowerCase();
    const uniqueBrands = new Map();
    products.forEach(p => {
      const b = Array.isArray(p.brands) ? p.brands[0] : p.brands;
      if (b && b.name && b.name.toLowerCase().includes(s)) {
        uniqueBrands.set(b.id, b);
      }
    });
    return Array.from(uniqueBrands.values());
  }, [products, search]);

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
          <div className={styles.searchBar} style={{ position: 'relative' }}>
            <Search size={16} style={{ opacity: 0.5, flexShrink: 0 }} />
            <input
              placeholder="Search delicacies or chefs..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={styles.searchInput}
            />
            {search.trim() && matchingVendors.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#121214', borderRadius: '8px', marginTop: '4px', padding: '8px', zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <div style={{ fontSize: '0.75rem', color: '#000000', marginBottom: '4px', padding: '0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Chefs matching "{search}"</div>
                {matchingVendors.map(v => {
                  const slug = v.name?.toLowerCase().replace(/\s+/g, '-') || 'brand';
                  return (
                  <Link key={v.id} href={`/vendor/${slug}?id=${v.id}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', textDecoration: 'none', color: '#000000', borderRadius: '4px' }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#121214', overflow: 'hidden' }}>
                      {v.logo_url ? <img src={v.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '10px' }}>{v.name[0]}</span>}
                    </div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{v.name}</span>
                  </Link>
                );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.container}>
        {/* ── FAST FILTERS & CATEGORIES ── */}
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

        {/* ── BROWSE BY CAFETERIA ── */}
        {cafeterias.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-100)' }}>🏪 Browse by Cafeteria</h3>
            <div style={{ display: 'flex', gap: '0.6rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
              <button
                onClick={() => setSelectedCafeteria(null)}
                style={{
                  flex: '0 0 auto', padding: '10px 18px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                  fontWeight: 600, fontSize: '0.82rem', transition: 'all 0.2s',
                  background: !selectedCafeteria ? 'var(--primary)' : 'var(--bg-100)',
                  color: !selectedCafeteria ? '#FFFFFF' : 'var(--text-200)',
                  boxShadow: !selectedCafeteria ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
                }}
              >
                All Cafeterias
              </button>
              {cafeterias.map(c => {
                const count = products.filter(p => (p.cafeteria_ids || []).includes(c.id)).length;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCafeteria(selectedCafeteria === c.id ? null : c.id)}
                    style={{
                      flex: '0 0 auto', padding: '10px 18px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                      fontWeight: 600, fontSize: '0.82rem', transition: 'all 0.2s',
                      background: selectedCafeteria === c.id ? 'var(--primary)' : 'var(--bg-100)',
                      color: selectedCafeteria === c.id ? '#FFFFFF' : 'var(--text-200)',
                      boxShadow: selectedCafeteria === c.id ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
                    }}
                  >
                    {c.name} <span style={{ opacity: 0.7, marginLeft: '4px' }}>({count})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── PRICE RANGE FILTER ── */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-200)' }}>💰 Price Range:</span>
          <input
            type="number"
            placeholder="Min ₦"
            value={priceMin}
            onChange={e => setPriceMin(e.target.value)}
            style={{
              width: '100px', padding: '8px 12px', borderRadius: '10px', border: '1.5px solid var(--border)',
              background: 'var(--bg-100)', fontSize: '0.82rem', color: 'var(--text-100)', outline: 'none',
            }}
          />
          <span style={{ fontSize: '0.82rem', color: 'var(--text-400)' }}>—</span>
          <input
            type="number"
            placeholder="Max ₦"
            value={priceMax}
            onChange={e => setPriceMax(e.target.value)}
            style={{
              width: '100px', padding: '8px 12px', borderRadius: '10px', border: '1.5px solid var(--border)',
              background: 'var(--bg-100)', fontSize: '0.82rem', color: 'var(--text-100)', outline: 'none',
            }}
          />
          {(priceMin || priceMax) && (
            <button
              onClick={() => { setPriceMin(''); setPriceMax(''); }}
              style={{
                padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)',
                background: 'transparent', fontSize: '0.75rem', cursor: 'pointer', color: 'var(--text-300)',
              }}
            >
              Clear
            </button>
          )}
        </div>

        {/* ── BILLBOARD SLIDER ── */}
        {billboards.length > 0 && (
          <div className={styles.billboard}>
            <Link href={billboards[billboardIdx].brand_id ? `/vendor/brand?id=${billboards[billboardIdx].brand_id}` : '#'}>
              <img src={billboards[billboardIdx].image_url} alt="Promotion" className={styles.billboardImg} />
            </Link>
            {billboards.length > 1 && (
              <div className={styles.billboardDots}>
                {billboards.map((_, i) => (
                  <div key={i} className={`${styles.dot} ${i === billboardIdx ? styles.dotActive : ''}`} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── HORIZONTAL HALL OF FAME ── */}
        <div className={styles.hallOfFame}>
          {/* Top Chefs Section */}
          <div className={styles.hofSection}>
            <div className={styles.hofHeader}>
              <Trophy size={20} style={{ color: '#FFFFFF' }} />
              <span>Weekly Hall of Fame (Top Chefs)</span>
              <Link href="/delicacies/rankings" className={styles.viewFullLink} style={{ margin: 0, padding: 0, fontSize: '0.8rem' }}>View Full →</Link>
            </div>
            <div className={styles.hofScroll}>
              {rankings.map((r, i) => {
                const brand = Array.isArray(r.brands) ? r.brands[0] : r.brands;
                const brandSlug = brand?.name?.toLowerCase().replace(/\s+/g, '-') || 'brand';
                return (
                  <Link key={i} href={`/vendor/${brandSlug}?id=${brand?.id}`} className={styles.vendorCircle}>
                    <div className={styles.circleFrame}>
                      {brand?.logo_url ? <img src={brand.logo_url} alt="" /> : <span>{brand?.name?.[0]}</span>}
                    </div>
                    <div className={styles.vendorName}>{brand?.name}</div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Top Dishes Section */}
          <div className={styles.hofSection}>
            <div className={styles.hofHeader}>
              <Star size={20} style={{ color: '#FFFFFF' }} />
              <span>Dish of the Week (Top Rated)</span>
              <Link href="/delicacies/rankings?tab=products" className={styles.viewFullLink} style={{ margin: 0, padding: 0, fontSize: '0.8rem' }}>View All →</Link>
            </div>
            <div className={styles.hofScroll}>
              {topDishes.map((d, i) => (
                <Link key={d.id} href={`/product/${d.id}`} className={styles.dishVertical}>
                  <div className={styles.dishRank}>#{i+1}</div>
                  <img src={d.media_urls?.[0] || '/placeholder.png'} alt="" className={styles.dishImg} />
                  <div className={styles.dishOverlay}>
                    <div className={styles.dishName}>{d.title}</div>
                  </div>
                </Link>
              ))}
            </div>
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

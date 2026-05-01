'use client';
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { SlidersHorizontal, Grid3X3, LayoutList, Search, X, Store, ShoppingBag, Sparkles, Shirt, Gem, Scissors, Footprints, Watch, Briefcase } from 'lucide-react';
import ProductCard, { LiveProduct } from '@/components/ProductCard';
import { useMarketplaceStore } from '@/store/marketplaceStore';
import styles from './explore.module.css';

const CATEGORIES = [
  { id: 'all', label: 'All Items', icon: <Sparkles size={16} /> },
  { id: 'Mens-Fashion', label: "Men's Fashion", icon: <Shirt size={16} /> },
  { id: 'Womens-Fashion', label: "Women's Fashion", icon: <Gem size={16} /> },
  { id: 'Traditional-Wear', label: 'Traditional', icon: <Scissors size={16} /> },
  { id: 'Footwear', label: 'Footwear', icon: <Footprints size={16} /> },
  { id: 'Accessories', label: 'Accessories', icon: <Watch size={16} /> },
  { id: 'Bags', label: 'Bags', icon: <Briefcase size={16} /> },
];

const SORT_OPTIONS = [
  { value: 'trending', label: 'Trending' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'newest', label: 'Newest First' },
];

export default function ExplorePage() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sort, setSort] = useState('trending');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const allProducts = useMarketplaceStore(s => s.products);
  const loading = !useMarketplaceStore(s => s.isInitialized);

  // â”€â”€ Derive vendors list from products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const allVendors = useMemo(() => {
    const map = new Map<string, any>();
    allProducts.forEach(p => {
      if (p.brands && !map.has(p.brand_id)) map.set(p.brand_id, p.brands);
    });
    return Array.from(map.values());
  }, [allProducts]);

  // â”€â”€ Main filtered products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const filtered = useMemo(() => {
    let result = [...allProducts].filter(p => !(p as any).is_draft);

    if (selectedCategory !== 'all') {
      const dbSearch = selectedCategory.toLowerCase().replace(/-/g, ' ');
      result = result.filter(p => {
        const cat = p.category?.toLowerCase() || '';
        return cat.includes(dbSearch) || dbSearch.includes(cat);
      });
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(p =>
        p.title?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
      );
    }

    switch (sort) {
      case 'price-asc': result.sort((a, b) => (a.price || 0) - (b.price || 0)); break;
      case 'price-desc': result.sort((a, b) => (b.price || 0) - (a.price || 0)); break;
      case 'rating': result.sort((a, b) => (b.rating || 0) - (a.rating || 0)); break;
      case 'newest': result.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()); break;
      default: result.sort((a, b) => (b.sold || b.sales_count || 0) - (a.sold || a.sales_count || 0)); break;
    }
    return result;
  }, [allProducts, selectedCategory, search, sort]);

  // â”€â”€ Similar products when search has no exact match â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const similarProducts = useMemo(() => {
    if (!search.trim() || filtered.length > 0) return [];
    const words = search.toLowerCase().split(' ').filter(w => w.length > 2);
    return allProducts
      .filter(p => !(p as any).is_draft && words.some(w =>
        p.title?.toLowerCase().includes(w) ||
        p.category?.toLowerCase().includes(w)
      ))
      .slice(0, 8);
  }, [allProducts, filtered, search]);

  // â”€â”€ Recommended (top selling, always show at bottom) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const recommended = useMemo(() => {
    return [...allProducts]
      .filter(p => !(p as any).is_draft)
      .sort((a, b) => (b.sales_count || 0) - (a.sales_count || 0))
      .slice(0, 8);
  }, [allProducts]);

  // â”€â”€ Vendor search results â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const vendorResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return allVendors.filter(v => v.name?.toLowerCase().includes(q)).slice(0, 4);
  }, [allVendors, search]);

  return (
    <main className="container">
      <div className={styles.page}>
        {/* Header */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Explore Fashion</h1>
            <p className={styles.pageSubtitle}>
              {loading ? 'Loading...' : `${filtered.length} products available`}
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <Search size={15} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search products, categories, vendors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
            />
            {search && (
              <button onClick={() => setSearch('')} className={styles.clearBtn}>
                <X size={14} />
              </button>
            )}
          </div>

          <select value={sort} onChange={(e) => setSort(e.target.value)} className="form-select">
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <div className={styles.viewToggle}>
            <button className={`${styles.viewBtn} ${view === 'grid' ? styles.viewActive : ''}`} onClick={() => setView('grid')} aria-label="Grid view"><Grid3X3 size={16} /></button>
            <button className={`${styles.viewBtn} ${view === 'list' ? styles.viewActive : ''}`} onClick={() => setView('list')} aria-label="List view"><LayoutList size={16} /></button>
          </div>
        </div>

        {/* Category Pills */}
        <div className={styles.categoryRow}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              className={`${styles.catPill} ${selectedCategory === cat.id ? styles.catActive : ''}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>

        {/* Vendor search results */}
        {vendorResults.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '0.75rem', color: 'var(--text-300)', fontSize: '0.9rem', fontWeight: 600 }}>ðŸª Matching Vendors</h3>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {vendorResults.map(v => (
                <Link key={v.id} href={`/vendor/${v.id}`} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'var(--bg-200)', border: '1px solid var(--border)', borderRadius: 12, textDecoration: 'none', color: 'var(--text-100)' }}>
                  {v.logo_url
                    ? <img src={v.logo_url} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} />
                    : <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg-300)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Store size={18} /></div>
                  }
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{v.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-400)' }}>View store â†’</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Products */}
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-300)' }}>Loading live catalog...</div>
        ) : filtered.length === 0 ? (
          <div>
            {similarProducts.length > 0 ? (
              <div>
                <div className={styles.empty} style={{ marginBottom: '2rem' }}>
                  <ShoppingBag size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                  <p>No exact match for <strong>&quot;{search}&quot;</strong>. Showing similar items:</p>
                </div>
                <div className={`${styles.productGrid} ${view === 'list' ? styles.listView : ''}`}>
                  {similarProducts.map((product) => <ProductCard key={product.id} product={product} />)}
                </div>
              </div>
            ) : (
              <div className={styles.empty}>
                <p>No products found. Try a different search or category.</p>
                <button className="btn btn-secondary" onClick={() => { setSearch(''); setSelectedCategory('all'); }}>
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className={`${styles.productGrid} ${view === 'list' ? styles.listView : ''}`}>
            {filtered.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        )}

        {/* Recommended Section — always shown */}
        {!loading && recommended.length > 0 && (
          <div style={{ marginTop: '3rem', borderTop: '1px solid var(--border)', paddingTop: '2rem' }}>
            <h2 style={{ marginBottom: '1.25rem', fontSize: '1.2rem' }}>âš¡ Recommended For You</h2>
            <div className={styles.productGrid}>
              {recommended.map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}


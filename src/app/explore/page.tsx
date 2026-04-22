'use client';
import { useState, useMemo } from 'react';
import { SlidersHorizontal, Grid3X3, LayoutList, Search, X } from 'lucide-react';
import ProductCard, { LiveProduct } from '@/components/ProductCard';
import { useMarketplaceStore } from '@/store/marketplaceStore';
import styles from './explore.module.css';

const CATEGORIES = [
  { id: 'all', label: 'All Items', icon: '✨' },
  { id: 'Mens-Fashion', label: "Men's Fashion", icon: '👕' },
  { id: 'Womens-Fashion', label: "Women's Fashion", icon: '👗' },
  { id: 'Traditional-Wear', label: "Traditional", icon: '✂️' },
  { id: 'Footwear', label: "Footwear", icon: '👟' },
  { id: 'Accessories', label: "Accessories", icon: '⌚' },
  { id: 'Bags', label: "Bags", icon: '👜' },
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
  const [showFilters, setShowFilters] = useState(false);

  // Live Realtime Data State
  const allProducts = useMarketplaceStore(s => s.products);
  const loading = !useMarketplaceStore(s => s.isInitialized);

  // Instant Client-Side Reactive Filtering
  const filtered = useMemo(() => {
    let result = [...allProducts].filter(p => !p.is_draft);

    // Category Filter
    if (selectedCategory !== 'all') {
      const dbSearch = selectedCategory.toLowerCase().replace(/-/g, ' '); 
      result = result.filter(p => {
        const cat = p.category?.toLowerCase() || '';
        return cat.includes(dbSearch) || dbSearch.includes(cat);
      });
    }

    // Search Filter
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(p => 
        p.title?.toLowerCase().includes(searchLower) || 
        p.description?.toLowerCase().includes(searchLower)
      );
    }

    // Sorting
    switch (sort) {
      case 'price-asc': result.sort((a, b) => (a.price || 0) - (b.price || 0)); break;
      case 'price-desc': result.sort((a, b) => (b.price || 0) - (a.price || 0)); break;
      case 'rating': result.sort((a, b) => (b.rating || 0) - (a.rating || 0)); break;
      case 'newest': result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
      default: result.sort((a, b) => (b.sold || 0) - (a.sold || 0)); break;
    }

    return result;
  }, [allProducts, selectedCategory, search, sort]);

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
              placeholder="Search products..."
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

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="form-select"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewBtn} ${view === 'grid' ? styles.viewActive : ''}`}
              onClick={() => setView('grid')}
              aria-label="Grid view"
            >
              <Grid3X3 size={16} />
            </button>
            <button
              className={`${styles.viewBtn} ${view === 'list' ? styles.viewActive : ''}`}
              onClick={() => setView('list')}
              aria-label="List view"
            >
              <LayoutList size={16} />
            </button>
          </div>

          <button
            className={`btn btn-ghost btn-sm ${styles.filterBtn}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal size={15} /> Filters
          </button>
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

        {/* Products */}
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-300)' }}>
            Loading live catalog...
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            <p>No products found. Try a different search or category.</p>
            <button className="btn btn-secondary" onClick={() => { setSearch(''); setSelectedCategory('all'); }}>
              Clear Filters
            </button>
          </div>
        ) : (
          <div className={`${styles.productGrid} ${view === 'list' ? styles.listView : ''}`}>
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

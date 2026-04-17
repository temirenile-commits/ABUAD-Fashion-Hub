'use client';
import { useState, useEffect } from 'react';
import { SlidersHorizontal, Grid3X3, LayoutList, Search, X } from 'lucide-react';
import ProductCard, { LiveProduct } from '@/components/ProductCard';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/lib/utils';
import styles from './explore.module.css';

const CATEGORIES = [
  { id: 'all', label: 'All Items', icon: '✨' },
  { id: 'Clothing', label: 'Clothing', icon: '🧥' },
  { id: 'Shoes', label: 'Footwear', icon: '👟' },
  { id: 'Accessories', label: 'Accessories', icon: '🧢' },
  { id: 'Bags', label: 'Bags', icon: '👜' },
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

  // Live Data State
  const [products, setProducts] = useState<LiveProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProducts() {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          brands(id, owner_id, name, whatsapp_number)
        `);
        
      if (!error && data) {
        setProducts(data as any as LiveProduct[]);
      } else {
        console.error('Fetch products error:', error);
      }
      setLoading(false);
    }
    fetchProducts();
  }, []);

  const filtered = products.filter((p) => {
    const matchCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const matchSearch =
      search === '' ||
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.brands?.name || '').toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchSearch;
  }).sort((a, b) => {
    switch (sort) {
      case 'price-asc': return a.price - b.price;
      case 'price-desc': return b.price - a.price;
      case 'rating': return (b.rating || 0) - (a.rating || 0);
      case 'newest': return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      default: return (b.sold || 0) - (a.sold || 0);
    }
  });

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

'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  CheckCircle,
  Zap,
  ShoppingBag,
  ArrowRight,
  ShieldCheck,
  Truck,
  RotateCcw
} from 'lucide-react';
import ProductCard, { LiveProduct } from '@/components/ProductCard';
import VendorCard, { LiveVendor } from '@/components/VendorCard';
import { useMarketplaceStore } from '@/store/marketplaceStore';
import { supabase } from '@/lib/supabase';
import styles from './page.module.css';

// New Jumia-style Components
import CategorySidebar from '@/components/CategorySidebar';
import MainSlider from '@/components/MainSlider';
import HeroExtras from '@/components/HeroExtras';
import TopCategories from '@/components/TopCategories';
import FlashSales from '@/components/FlashSales';

export default function Home() {
  const allProducts = useMarketplaceStore(s => s.products);
  const allBrands = useMarketplaceStore(s => s.vendors);
  const isInitialized = useMarketplaceStore(s => s.isInitialized);

  const [preferredCategories, setPreferredCategories] = useState<string[]>([]);
  const [targetedProducts, setTargetedProducts] = useState<LiveProduct[]>([]);
  const [fetchingTargeted, setFetchingTargeted] = useState(false);
  
  useEffect(() => {
    const fetchDiscovery = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setFetchingTargeted(true);
        try {
          const res = await fetch(`/api/discovery?userId=${session.user.id}`);
          const data = await res.json();
          if (data.products) setTargetedProducts(data.products);
        } catch (e) {
          console.error('Discovery error:', e);
        } finally {
          setFetchingTargeted(false);
        }
      }
    };
    fetchDiscovery();

    try {
      const prefs = JSON.parse(localStorage.getItem('user_prefs') || '[]');
      if (Array.isArray(prefs)) setPreferredCategories(prefs);
    } catch {}
  }, []);

  const featuredVendors = useMemo(() => {
     return [...allBrands].slice(0, 4) as any as LiveVendor[];
  }, [allBrands]);

  const genuineFlashSales = useMemo(() => {
     return allProducts.filter(p => !p.is_draft && (p.original_price || 0) > (p.price || 0)).slice(0, 10);
  }, [allProducts]);

  const flashSaleItems = genuineFlashSales.map(p => {
    const originalPrice = p.original_price || 0;
    const price = p.price || 0;
    const discount = originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;
    return {
      id: p.id,
      title: p.title,
      price: price,
      oldPrice: originalPrice,
      image: p.media_urls?.[0] || 'https://images.unsplash.com/photo-1542272201-b1ca555f8505?w=500',
      discount: discount
    };
  });

  // Personalization Algorithm
  const trendingProducts = useMemo(() => {
     if (!allProducts.length) return [];
     
     // Separate into preferred and others
     let preferred = allProducts.filter(p => !p.is_draft && p.category && preferredCategories.includes(p.category));
     let others = allProducts.filter(p => !p.is_draft && (!p.category || !preferredCategories.includes(p.category)));

     // Sort by newest
     preferred.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
     others.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

     // Combine: Prefered items first, then latest items
     const combined = [...preferred, ...others].slice(0, 8);
     return combined as any as LiveProduct[];
  }, [allProducts, preferredCategories]);

  return (
    <main className={styles.main}>
      {/* ───── JUMIA HERO TRIFECTA ───── */}
      <section className={styles.heroSection}>
        <div className="container-wide">
          <div className={styles.heroGrid}>
            <div className={styles.heroCategoryCol}>
              <CategorySidebar />
            </div>
            <div className={styles.heroMainCol}>
              <MainSlider />
            </div>
            <div className={styles.heroExtraCol}>
              <HeroExtras />
            </div>
          </div>
        </div>
      </section>

      <div className="container-wide">
        {/* ───── SERVICE BAR ───── */}
        <div className={styles.serviceBar}>
          <div className={styles.serviceItem}>
            <ShieldCheck size={20} className={styles.goldIcon} />
            <span>Escrow Protected Payments</span>
          </div>
          <div className={styles.serviceItem}>
            <Truck size={20} className={styles.goldIcon} />
            <span>Fast Campus Delivery</span>
          </div>
          <div className={styles.serviceItem}>
            <RotateCcw size={20} className={styles.goldIcon} />
            <span>Easy 24h Returns</span>
          </div>
          <div className={styles.serviceItem}>
            <Zap size={20} className={styles.goldIcon} />
            <span>Verified Student Brands</span>
          </div>
        </div>

        {/* ───── CIRCLE CATEGORIES (Mobile Discovery) ───── */}
        <div className={styles.mobileCategorySection}>
          <TopCategories />
        </div>

        {/* ───── FLASH SALES ───── */}
        {flashSaleItems.length > 0 && <FlashSales items={flashSaleItems} />}

        {/* ───── TRENDING PRODUCTS (Personalized) ───── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionTitleGroup}>
              <TrendingUp size={20} className={styles.sectionIcon} />
              <h2>Recommended For You</h2>
            </div>
            <Link href="/explore" className={styles.seeAll}>
              View all <ArrowRight size={14} />
            </Link>
          </div>

          <div className={`${styles.productGrid} stagger`}>
            {(targetedProducts.length > 0 ? targetedProducts : trendingProducts).length > 0 ? (
              (targetedProducts.length > 0 ? targetedProducts : trendingProducts).map((product) => (
                <div key={product.id} className="anim-fade-up">
                  <ProductCard product={product} />
                </div>
              ))
            ) : isInitialized ? (
              <p style={{ color: 'var(--text-400)', gridColumn: '1/-1', textAlign: 'center', padding: '2rem' }}>
                No active products currently on the marketplace.
              </p>
            ) : (
               <p style={{ color: 'var(--text-400)', gridColumn: '1/-1', textAlign: 'center', padding: '2rem' }}>
                Loading live personalized feed...
              </p>
            )}
          </div>
        </section>

        {/* ───── FEATURED VENDORS ───── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionTitleGroup}>
              <CheckCircle size={20} className={styles.goldIcon} />
              <h2>Official Campus Stores</h2>
            </div>
            <Link href="/vendors" className={styles.seeAll}>
              Full Retailer List <ArrowRight size={14} />
            </Link>
          </div>
          <div className={`${styles.vendorGrid} stagger`}>
            {featuredVendors.length > 0 ? (
              featuredVendors.map((vendor) => (
                <div key={vendor.id} className="anim-fade-up">
                  <VendorCard vendor={vendor} />
                </div>
              ))
            ) : (
              <p style={{ color: 'var(--text-400)', gridColumn: '1/-1', textAlign: 'center', padding: '2rem' }}>
                {isInitialized ? 'No verified vendors found.' : 'Loading campus partners...'}
              </p>
            )}
          </div>
        </section>

        {/* ───── CTA BANNER ───── */}
        <section className={styles.ctaBanner}>
          <div className={styles.ctaContent}>
            <div className={styles.ctaIcon}>
              <ShoppingBag size={48} />
            </div>
            <h2>Got a Fashion Brand on Campus?</h2>
            <p>
              Join the elite ecosystem of student brands. Sell securely, ship faster.
            </p>
            <div className={styles.ctaActions}>
              <Link href="/onboarding" className="btn btn-primary btn-lg">
                Activate Your Store <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

'use client';
/* eslint-disable @next/next/no-img-element */
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
  RotateCcw,
  Video,
  Play,
  MoreVertical
} from 'lucide-react';
import ProductCard, { LiveProduct } from '@/components/ProductCard';
import VendorCard, { LiveVendor } from '@/components/VendorCard';
import { useMarketplaceStore } from '@/store/marketplaceStore';
import { supabase } from '@/lib/supabase';
import styles from './page.module.css';
import VividVideo from '@/components/VividVideo';

// New Jumia-style Components
import CategorySidebar from '@/components/CategorySidebar';
import MainSlider from '@/components/MainSlider';
import HeroExtras from '@/components/HeroExtras';
import TopCategories from '@/components/TopCategories';
import FlashSales from '@/components/FlashSales';
import WelcomeModal from '@/components/WelcomeModal';
import DynamicMerchandising from '@/components/DynamicMerchandising';
import DelicaciesPreview from '@/components/DelicaciesPreview';

export default function Home() {
  const allProducts = useMarketplaceStore(s => s.products);
  const allBrands = useMarketplaceStore(s => s.vendors);
  const allReels = useMarketplaceStore(s => s.reels);
  const isInitialized = useMarketplaceStore(s => s.isInitialized);

  const [preferredCategories, setPreferredCategories] = useState<string[]>([]);
  const [targetedProducts, setTargetedProducts] = useState<LiveProduct[]>([]);
  const [flashSalesEvents, setFlashSalesEvents] = useState<{ id?: string; title: string; product_ids?: string[] }[]>([]);
  const [userUniversityId, setUserUniversityId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const fetchFlashSales = async () => {
      const { data } = await supabase.from('platform_settings').select('value').eq('key', 'flash_sales_events').single();
      if (data && data.value) setFlashSalesEvents(data.value as { id?: string; title: string; product_ids?: string[] }[]);
    };
    fetchFlashSales();
  }, []);

  useEffect(() => {
    const fetchDiscovery = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        try {
          const res = await fetch(`/api/discovery?userId=${session.user.id}`);
          const data = await res.json();
          if (data.products) setTargetedProducts(data.products);
        } catch (e) {
          console.error('Discovery error:', e);
        }
      }
    };
    fetchDiscovery();

    const initPrefs = async () => {
      try {
        const prefs = JSON.parse(localStorage.getItem('user_prefs') || '[]');
        if (Array.isArray(prefs)) setPreferredCategories(prefs);
      } catch {}
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: profile } = await supabase.from('users').select('university_id').eq('id', session.user.id).single();
          setUserUniversityId(profile?.university_id || undefined);
        }
      } catch {}
    };
    initPrefs();
  }, []);

  const featuredVendors = useMemo(() => {
     return [...allBrands].slice(0, 4) as unknown as LiveVendor[];
  }, [allBrands]);

  const genuineFlashSales = useMemo(() => {
     return allProducts.filter(p => 
       !p.is_draft && 
       (!p.product_section || p.product_section === 'fashion') &&
       ((p as unknown as { is_flash_sale?: boolean }).is_flash_sale || (p.original_price || 0) > (p.price || 0))
     ).slice(0, 10);
  }, [allProducts]);

  const fallbackFlashSaleItems = genuineFlashSales.map(p => {
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
     
     // Only show Fashion products in the main marketplace feed
     const fashionProducts = allProducts.filter(p => !p.is_draft && (!p.product_section || p.product_section === 'fashion'));

     // Separate into preferred and others
     const preferred = fashionProducts.filter(p => p.category && preferredCategories.includes(p.category));
     const others = fashionProducts.filter(p => !p.category || !preferredCategories.includes(p.category));

     // Sort by newest
     preferred.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
     others.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

     // Combine: Prefered items first, then latest items
     const combined = [...preferred, ...others].slice(0, 8);
     return combined as unknown as LiveProduct[];
  }, [allProducts, preferredCategories]);

  return (
    <main className={styles.main}>
      <WelcomeModal />
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
        {flashSalesEvents.length > 0 ? flashSalesEvents.map((event, idx) => {
          // Map the event's product IDs to actual product data
          const eventItems = allProducts
            .filter(p => event.product_ids?.includes(p.id) && !p.is_draft)
            .map(p => {
              const originalPrice = p.original_price || p.price;
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
            
          if (eventItems.length === 0) return null;
          
          return (
            <div key={event.id || idx}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '2rem', marginBottom: '-1rem', color: 'var(--primary)' }}>
                ⚡ {event.title}
              </h2>
              <FlashSales items={eventItems} />
            </div>
          );
        }) : (
          fallbackFlashSaleItems.length > 0 && <FlashSales items={fallbackFlashSaleItems} />
        )}

        {/* ───── FASHION REELS (Vivid Videos) ───── */}
        {allReels.length > 0 && (
          <section className={styles.section} style={{ paddingBottom: 0 }}>
            <div className={styles.sectionHead}>
              <div className={styles.sectionTitleGroup}>
                <Video size={20} className={styles.goldIcon} />
                <h2>Trending Collection Reels</h2>
              </div>
              <Link href="/reels" className={styles.seeAll}>
                Watch Full Feed <ArrowRight size={14} />
              </Link>
            </div>
            <div className={styles.reelsRow}>
              {allReels.filter(r => !r.product_section || r.product_section === 'fashion').map((reel) => (
                <div key={reel.id} className={styles.reelCard}>
                  <div className={styles.reelVideoWrap}>
                    <VividVideo 
                      src={reel.video_url} 
                      className={styles.reelVideo}
                    />
                    <div className={styles.playOverlay}>
                      <Play size={24} fill="currentColor" />
                    </div>
                  </div>
                  
                  <div className={styles.reelInfo}>
                    {reel.brands?.logo_url ? (
                      <img src={reel.brands.logo_url} alt="" className={styles.reelBrandLogo} />
                    ) : (
                      <div className={styles.reelBrandLogo} style={{ background: 'var(--primary)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 800 }}>
                        {reel.brands?.name?.substring(0, 1)}
                      </div>
                    )}
                    <div className={styles.reelMeta}>
                      <div className={styles.reelTitle}>{reel.title || 'Collection Reel'}</div>
                      <div className={styles.reelBrandName}>{reel.brands?.name}</div>
                    </div>
                    <button className="btn btn-ghost btn-icon" style={{ padding: 0, opacity: 0.6 }}>
                      <MoreVertical size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ───── DYNAMIC MERCHANDISING SECTIONS (Admin Controlled) ───── */}
        <DynamicMerchandising />

        {/* ───── MASTERCART DELICACIES ───── */}
        <DelicaciesPreview universityId={userUniversityId} />

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

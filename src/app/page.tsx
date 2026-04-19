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
import { supabaseAdmin } from '@/lib/supabase-admin';
import styles from './page.module.css';

// New Jumia-style Components
import CategorySidebar from '@/components/CategorySidebar';
import MainSlider from '@/components/MainSlider';
import HeroExtras from '@/components/HeroExtras';
import TopCategories from '@/components/TopCategories';
import FlashSales from '@/components/FlashSales';

export const revalidate = 60;

export default async function Home() {
  // Fetch trending products
  const { data: trendingData } = await supabaseAdmin
    .from('products')
    .select('*, brands(id, owner_id, name, whatsapp_number, logo_url)')
    .limit(8);

  const trendingProducts = (trendingData || []) as any[] as LiveProduct[];

  // Fetch verified brands
  const { data: brandsData } = await supabaseAdmin
    .from('brands')
    .select('*')
    .eq('verified', true)
    .limit(4);

  const featuredVendors = (brandsData || []) as any[] as LiveVendor[];

  // Genuine Flash Sales (Only items explicitly discounted by vendors)
  // `original_price` greater than `price` signifies a live discount
  const { data: flashData } = await supabaseAdmin
    .from('products')
    .select('id, title, price, original_price, media_urls')
    .not('original_price', 'is', null)
    .gt('original_price', 0)
    .limit(15);
  
  const rawFlashSales = (flashData || []) as any[];
  const genuineFlashSales = rawFlashSales.filter(p => p.original_price > p.price).slice(0, 5);

  const flashSaleItems = genuineFlashSales.map(p => {
    const discount = Math.round(((p.original_price - p.price) / p.original_price) * 100);
    return {
      id: p.id,
      title: p.title,
      price: p.price,
      oldPrice: p.original_price,
      image: p.media_urls?.[0] || 'https://images.unsplash.com/photo-1542272201-b1ca555f8505?w=500',
      discount: discount
    };
  });

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
        <FlashSales items={flashSaleItems} />

        {/* ───── TRENDING PRODUCTS ───── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionTitleGroup}>
              <TrendingUp size={20} className={styles.sectionIcon} />
              <h2>Trending on Campus</h2>
            </div>
            <Link href="/explore" className={styles.seeAll}>
              View all <ArrowRight size={14} />
            </Link>
          </div>

          <div className={`${styles.productGrid} stagger`}>
            {trendingProducts.length > 0 ? (
              trendingProducts.map((product) => (
                <div key={product.id} className="anim-fade-up">
                  <ProductCard product={product} />
                </div>
              ))
            ) : (
              <p style={{ color: 'var(--text-400)', gridColumn: '1/-1', textAlign: 'center', padding: '2rem' }}>
                Catalog update in progress. Check back soon!
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
                Becoming a verified vendor...
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

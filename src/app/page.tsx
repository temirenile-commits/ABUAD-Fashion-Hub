import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  TrendingUp,
  CheckCircle,
  Zap,
  ShoppingBag,
  Star,
  Play,
} from 'lucide-react';
import ProductCard, { LiveProduct } from '@/components/ProductCard';
import { formatPrice } from '@/lib/utils';
import VendorCard, { LiveVendor } from '@/components/VendorCard';
import { supabaseAdmin } from '@/lib/supabase-admin';
import styles from './page.module.css';

const CATEGORIES = [
  { id: 'all', label: 'All Items', icon: '✨' },
  { id: 'Clothing', label: 'Clothing', icon: '🧥' },
  { id: 'Shoes', label: 'Footwear', icon: '👟' },
  { id: 'Accessories', label: 'Accessories', icon: '🧢' },
  { id: 'Bags', label: 'Bags', icon: '👜' },
];

export const revalidate = 60; // Revalidate every minute

export default async function Home() {
  // 1. Fetch Featured Products (Mosaic)
  const { data: mosaicData } = await supabaseAdmin
    .from('products')
    .select('*, brands(id, owner_id, name, whatsapp_number)')
    .eq('is_featured', true)
    .limit(4);

  const mosaicProducts = (mosaicData || []) as any[] as LiveProduct[];

  // 2. Fetch Trending Products
  const { data: trendingData } = await supabaseAdmin
    .from('products')
    .select('*, brands(id, owner_id, name, whatsapp_number)')
    .limit(8); // For now, just taking top 8 since we don't have complex trending logic yet

  const trendingProducts = (trendingData || []) as any[] as LiveProduct[];

  // 3. Fetch Verified Brands
  const { data: brandsData } = await supabaseAdmin
    .from('brands')
    .select('*')
    .eq('verified', true)
    .limit(4);

  const featuredVendors = (brandsData || []) as any[] as LiveVendor[];

  // 4. Fetch Featured Services
  const { data: servicesData } = await supabaseAdmin
    .from('services')
    .select('*, brands(id, owner_id, name, whatsapp_number)')
    .limit(4);

  const featuredServices = (servicesData || []) as any[];

  // 5. Fetch Collection Reels (Paid only)
  const { data: reelsData } = await supabaseAdmin
    .from('brand_reels')
    .select('*, brands(name, logo_url)')
    .eq('is_paid', true)
    .limit(10);

  const activeReels = (reelsData || []) as any[];

  return (
    <main>
      {/* ───── HERO ───── */}
      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={`container ${styles.heroInner}`}>
          <div className={`${styles.heroContent} anim-fade-up`}>
            <div className={`badge badge-brand ${styles.heroBadge}`}>
              <Zap size={12} /> #1 ABUAD Campus Fashion Marketplace
            </div>

            <h1 className={styles.heroTitle}>
              Discover <span className="text-gradient">Premium</span> Campus
              Fashion
            </h1>

            <p className={styles.heroSub}>
              Shop from verified student brands, connect with fashion
              services, and discover what&apos;s trending on campus — all in one
              place.
            </p>

            <div className={styles.heroActions}>
              <Link href="/explore" className="btn btn-primary btn-lg">
                <ShoppingBag size={18} /> Shop Now
              </Link>
              <Link href="/onboarding" className="btn btn-ghost btn-lg">
                Sell on ABUAD Hub <ArrowRight size={18} />
              </Link>
            </div>

            <div className={styles.heroStats}>
              {[
                { num: 'Verified', label: 'Brands' },
                { num: 'Escrow', label: 'Payments' },
                { num: 'Fast', label: 'Logistics' },
              ].map(({ num, label }) => (
                <div key={label} className={styles.heroStat}>
                  <span className={styles.heroStatNum}>{num}</span>
                  <span className={styles.heroStatLabel}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Hero Product Mosaic */}
          <div className={`${styles.heroMosaic} anim-fade-in`}>
            {mosaicProducts.length > 0 ? (
              <div className={styles.mosaicGrid}>
                {mosaicProducts.map((p, i) => (
                  <div key={p.id} className={`${styles.mosaicItem} ${i === 0 ? styles.mosaicBig : ''}`}>
                    <Image
                      src={p.media_urls?.[0] || ''}
                      alt={p.title}
                      fill
                      sizes="300px"
                      className={styles.mosaicImg}
                    />
                    <div className={styles.mosaicOverlay}>
                      <span>{p.title}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.mosaicPlaceholder}>
                <ShoppingBag size={48} color="var(--text-400)" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ───── PROMO BAR ───── */}
      <div className={styles.promoBar}>
        <div className={`container ${styles.promoInner}`}>
          <span className={`badge badge-flash`}>⚡ Campus News</span>
          <span className={styles.promoText}>
            Phase 3 Marketplace is now LIVE with Secure Escrow Payments!
          </span>
          <Link href="/explore" className={`btn btn-secondary btn-sm`}>
            Browse Now
          </Link>
        </div>
      </div>

      {/* ───── BRAND REELS (PREMIUM) ───── */}
      {activeReels.length > 0 && (
        <section className={`${styles.reelsSection} anim-fade-in`}>
          <div className="container">
            <div className={styles.sectionHead}>
              <div className={styles.sectionTitleGroup}>
                <Play size={20} className={styles.sectionIconGold} />
                <h2>Collection Reels</h2>
                <span className={`badge badge-gold`}>Premium</span>
              </div>
            </div>
          </div>
          <div className={styles.reelsTrack}>
            <div className={styles.reelsInner}>
              {activeReels.map((reel) => (
                <div key={reel.id} className={styles.reelItem}>
                  <video
                    src={reel.video_url}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className={styles.reelVideo}
                  />
                  <div className={styles.reelOverlay}>
                    <div className={styles.reelBrand}>
                      <div className={styles.reelLogo}>
                        {reel.brands.logo_url ? (
                          <img src={reel.brands.logo_url} alt="" />
                        ) : (
                          reel.brands.name.charAt(0)
                        )}
                      </div>
                      <span>{reel.brands.name}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ───── CATEGORIES ───── */}
      <section className={`container ${styles.section}`}>
        <div className={styles.sectionHead}>
          <h2>Shop by Category</h2>
          <Link href="/explore" className={styles.seeAll}>
            See all <ArrowRight size={14} />
          </Link>
        </div>
        <div className={styles.categoryGrid}>
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.id}
              href={`/explore?category=${cat.id}`}
              className={styles.categoryChip}
            >
              <span className={styles.categoryIcon}>{cat.icon}</span>
              <span>{cat.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ───── TRENDING PRODUCTS ───── */}
      <section className={`container ${styles.section}`}>
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
              No items listed yet. Check back soon!
            </p>
          )}
        </div>
      </section>

      {/* ───── FEATURED VENDORS ───── */}
      <section className={`${styles.vendorsSection}`}>
        <div className={`container ${styles.section}`}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionTitleGroup}>
              <CheckCircle size={20} className={styles.sectionIconBlue} />
              <h2>Verified Campus Brands</h2>
            </div>
            <Link href="/vendors" className={styles.seeAll}>
              All Vendors <ArrowRight size={14} />
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
                Join our verified vendor program today!
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ───── SERVICES SECTION ───── */}
      <section className={`container ${styles.section}`}>
        <div className={styles.sectionHead}>
          <h2>Campus Fashion Services</h2>
          <Link href="/services" className={styles.seeAll}>
            All Services <ArrowRight size={14} />
          </Link>
        </div>
        <div className={styles.servicesGrid}>
          {featuredServices.length > 0 ? (
            featuredServices.map((svc) => (
              <div key={svc.id} className={styles.serviceCard}>
                <div className={styles.serviceImgWrap}>
                  <Image
                    src={svc.portfolio_urls?.[0] || 'https://images.unsplash.com/photo-1542272201-b1ca555f8505?w=500&auto=format&fit=crop&q=60'}
                    alt={svc.title}
                    fill
                    sizes="300px"
                    className={styles.serviceImg}
                  />
                  <div className={styles.serviceOverlay} />
                  <span className={`badge badge-gold ${styles.serviceTypeBadge}`}>
                    {svc.service_type}
                  </span>
                </div>
                <div className={styles.serviceBody}>
                  <h3 className={styles.serviceTitle}>{svc.title}</h3>
                  <p className={styles.serviceBrand}>{svc.brands.name}</p>
                  <div className={styles.serviceFooter}>
                    <div className={styles.serviceRating}>
                      <Star size={12} fill="currentColor" className="star-filled" />
                      <span>{svc.rating || 4.8}</span>
                    </div>
                    <span className={styles.servicePrice}>{formatPrice(svc.price)}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p style={{ color: 'var(--text-400)', gridColumn: '1/-1', textAlign: 'center', padding: '2rem' }}>
              Service marketplace opening soon!
            </p>
          )}
        </div>
      </section>

      {/* ───── CTA BANNER ───── */}
      <section className={`container ${styles.ctaBanner}`}>
        <div className={styles.ctaContent}>
          <h2>Got a Fashion Brand on Campus?</h2>
          <p>
            Join verified vendors already growing their business on ABUAD
            Fashion Hub. Safe escrow payments and faster delivery.
          </p>
          <Link href="/onboarding" className="btn btn-primary btn-lg">
            Start Selling Today <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </main>
  );
}

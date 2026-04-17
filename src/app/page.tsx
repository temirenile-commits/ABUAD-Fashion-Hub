import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  TrendingUp,
  CheckCircle,
  Zap,
  ShoppingBag,
  Star,
} from 'lucide-react';
import ProductCard from '@/components/ProductCard';
import VendorCard from '@/components/VendorCard';
import { PRODUCTS, VENDORS, SERVICES, CATEGORIES } from '@/lib/data';
import styles from './page.module.css';

export default function Home() {
  const trendingProducts = PRODUCTS.filter((p) => p.trending).slice(0, 8);
  const featuredVendors = VENDORS.filter((v) => v.verified).slice(0, 4);
  const featuredServices = SERVICES.slice(0, 4);

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
              Shop from 50+ verified student brands, connect with fashion
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
                { num: '50+', label: 'Verified Brands' },
                { num: '500+', label: 'Products' },
                { num: '2K+', label: 'Students' },
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
            <div className={styles.mosaicGrid}>
              {PRODUCTS.filter((p) => p.featured).slice(0, 4).map((p, i) => (
                <div key={p.id} className={`${styles.mosaicItem} ${i === 0 ? styles.mosaicBig : ''}`}>
                  <Image
                    src={p.image}
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
          </div>
        </div>
      </section>

      {/* ───── FLASH DEALS / PROMO BAR ───── */}
      <div className={styles.promoBar}>
        <div className={`container ${styles.promoInner}`}>
          <span className={`badge badge-flash`}>⚡ Flash Deals</span>
          <span className={styles.promoText}>
            Limited-time offers from top campus brands — up to 30% off!
          </span>
          <Link href="/explore?filter=deals" className={`btn btn-secondary btn-sm`}>
            Shop Deals
          </Link>
        </div>
      </div>

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
            <h2>Trending This Week</h2>
          </div>
          <Link href="/explore" className={styles.seeAll}>
            View all <ArrowRight size={14} />
          </Link>
        </div>

        <div className={`${styles.productGrid} stagger`}>
          {trendingProducts.map((product) => (
            <div key={product.id} className="anim-fade-up">
              <ProductCard product={product} />
            </div>
          ))}
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
            {featuredVendors.map((vendor) => (
              <div key={vendor.id} className="anim-fade-up">
                <VendorCard vendor={vendor} />
              </div>
            ))}
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
          {featuredServices.map((svc) => (
            <Link key={svc.id} href={`/service/${svc.id}`} className={styles.serviceCard}>
              <div className={styles.serviceImgWrap}>
                <Image
                  src={svc.image}
                  alt={svc.title}
                  fill
                  sizes="300px"
                  className={styles.serviceImg}
                />
                <div className={styles.serviceOverlay} />
                <span className={`badge badge-gold ${styles.serviceTypeBadge}`}>
                  {svc.serviceType}
                </span>
              </div>
              <div className={styles.serviceBody}>
                <h3 className={styles.serviceTitle}>{svc.title}</h3>
                <p className={styles.serviceBrand}>{svc.brand}</p>
                <div className={styles.serviceFooter}>
                  <div className={styles.serviceRating}>
                    <Star size={12} fill="currentColor" className="star-filled" />
                    <span>{svc.rating}</span>
                    <span style={{ color: 'var(--text-400)' }}>({svc.reviews})</span>
                  </div>
                  <span className={styles.servicePrice}>{svc.price}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ───── CTA BANNER ───── */}
      <section className={`container ${styles.ctaBanner}`}>
        <div className={styles.ctaContent}>
          <h2>Got a Fashion Brand on Campus?</h2>
          <p>
            Join 50+ verified vendors already growing their business on ABUAD
            Fashion Hub. It&apos;s free to start.
          </p>
          <Link href="/onboarding" className="btn btn-primary btn-lg">
            Start Selling Today <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </main>
  );
}

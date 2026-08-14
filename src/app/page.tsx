'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Heart,
  MapPin,
  Play,
  ShieldCheck,
  Truck,
  Zap,
  Video,
} from 'lucide-react';
import ProductCard, { LiveProduct } from '@/components/ProductCard';
import VendorCard, { LiveVendor } from '@/components/VendorCard';
import { useMarketplaceStore } from '@/store/marketplaceStore';
import { supabase } from '@/lib/supabase';
import styles from './page.module.css';
import DynamicMerchandising from '@/components/DynamicMerchandising';
import DelicaciesPreview from '@/components/DelicaciesPreview';
import MainSlider from '@/components/MainSlider';

const formatNaira = (value: number) => `₦${new Intl.NumberFormat('en-NG').format(value)}`;

// No fallback mock products; real database records are queried exclusively.

// No fallback mock vendors; real database records are queried exclusively.

export default function Home() {
  const allProducts = useMarketplaceStore((s) => s.products);
  const allBrands = useMarketplaceStore((s) => s.vendors);
  const allReels = useMarketplaceStore((s) => s.reels);
  const isInitialized = useMarketplaceStore((s) => s.isInitialized);
  const [preferredCategories, setPreferredCategories] = useState<string[]>([]);
  const [targetedProducts, setTargetedProducts] = useState<LiveProduct[]>([]);
  const [userUniversityId, setUserUniversityId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const initPreferences = async () => {
      try {
        const prefs = JSON.parse(localStorage.getItem('user_prefs') || '[]');
        if (Array.isArray(prefs)) setPreferredCategories(prefs);
      } catch {
        setPreferredCategories([]);
      }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data: profile } = await supabase.from('users').select('university_id').eq('id', session.user.id).single();
        setUserUniversityId(profile?.university_id || undefined);
        const response = await fetch(`/api/discovery?userId=${session.user.id}`);
        const discovery = await response.json();
        if (discovery.products) setTargetedProducts(discovery.products as LiveProduct[]);
      } catch {
        // The homepage remains fully usable when personalization is unavailable.
      }
    };
    initPreferences();
  }, []);

  const fashionProducts = useMemo(() => {
    const products = allProducts.filter((product) => !product.is_draft && (!product.product_section || product.product_section === 'fashion'));
    const preferred = products.filter((product) => product.category && preferredCategories.includes(product.category));
    const others = products.filter((product) => !product.category || !preferredCategories.includes(product.category));
    return [...preferred, ...others].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()) as unknown as LiveProduct[];
  }, [allProducts, preferredCategories]);

  const categoryLinks = useMemo(() => {
    const counts = new Map<string, number>();
    allProducts.forEach((product) => {
      if (product.is_draft || !product.category) return;
      counts.set(product.category, (counts.get(product.category) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label], index) => [label, String(index + 1).padStart(2, '0')] as [string, string]);
  }, [allProducts]);

  const featuredVendors = useMemo(() => {
    return allBrands.filter((vendor) => !vendor.marketplace_type || vendor.marketplace_type === 'fashion').slice(0, 4) as unknown as LiveVendor[];
  }, [allBrands]);

  const trendingProducts = useMemo(() => {
    return allProducts
      .filter((product) => !product.is_draft && (!product.product_section || product.product_section === 'fashion'))
      .sort((a, b) => ((b.sales_count || 0) * 3 + (b.views_count || 0)) - ((a.sales_count || 0) * 3 + (a.views_count || 0)))
      .slice(0, 4);
  }, [allProducts]);

  const flashItems = useMemo(() => {
    const saleProducts = allProducts.filter((product) => {
      const sale = product as unknown as { is_flash_sale?: boolean; flash_sale_price?: number };
      return !product.is_draft && (!product.product_section || product.product_section === 'fashion') && sale.is_flash_sale === true;
    }).slice(0, 5);
    return saleProducts.map((product) => {
      const sale = product as unknown as { flash_sale_price?: number };
      const regularPrice = Number(product.price || 0);
      const salePrice = Number(sale.flash_sale_price || regularPrice);
      return {
        title: product.title,
        brand: product.brands?.name || 'Verified campus store',
        price: salePrice,
        oldPrice: regularPrice,
        image: product.media_urls?.[0] || product.image_url,
        tag: regularPrice > salePrice ? `-${Math.round(((regularPrice - salePrice) / regularPrice) * 100)}%` : 'Live',
      };
    });
  }, [allProducts]);

  const selectedProducts = targetedProducts.length ? targetedProducts : fashionProducts;
  const renderableProducts = selectedProducts.slice(0, 5);

  return (
    <main className={styles.main}>
      <section className={styles.heroSection}>
        <div className="container-wide">
          <div className={styles.heroGrid}>
            <aside className={styles.categoryPanel} aria-label="Shop by category">
              <div className={styles.panelKicker}>Browse the marketplace</div>
              <h2>Shop by category</h2>
              <nav className={styles.categoryList}>
                {categoryLinks.length ? categoryLinks.map(([label, number], index) => (
                  <Link href={`/explore?category=${encodeURIComponent(label)}`} className={`${styles.categoryLink} ${index === 0 ? styles.categoryLinkActive : ''}`} key={label}>
                    <span>{label}</span>
                    <span className={styles.categoryNumber}>{number}</span>
                    <ChevronRight size={15} />
                  </Link>
                )) : <p className={styles.emptyNotice}>No categories available yet.</p>}
              </nav>
              <Link href="/explore" className={styles.browseAll}>View all categories <ArrowRight size={14} /></Link>
            </aside>

            <div className={styles.heroCard}>
              <MainSlider defaultContent={
                <>
                  <div className={styles.heroCopy}>
                    <div className={styles.eyebrow}><span className={styles.liveDot} /> ABUAD / CAMPUS MARKETPLACE</div>
                    <h1>Everything you need.<br /><em>One campus.</em></h1>
                    <p>Discover verified student brands, everyday essentials, and the next big thing before it sells out.</p>
                    <div className={styles.heroActions}>
                      <Link href="/explore" className={styles.primaryButton}>Explore marketplace <ArrowRight size={16} /></Link>
                      <Link href="/vendors" className={styles.secondaryButton}>Discover stores</Link>
                    </div>
                  </div>
                  <div className={styles.heroLocation}><MapPin size={14} /> Available around ABUAD</div>
                  <div className={styles.heroStats}>
                    <div><strong>{allProducts.filter((product) => !product.is_draft).length}</strong><span>campus finds</span></div>
                    <div><strong>{allBrands.filter((vendor) => vendor.verification_status === 'approved' || (vendor as unknown as { verified?: boolean }).verified === true).length}</strong><span>verified stores</span></div>
                  </div>
                </>
              } />
            </div>

            <aside className={styles.dealPanel}>
              <div className={styles.dealHeader}><span className={styles.panelKicker}>Limited drops</span><Zap size={19} /></div>
              <h2>Quick deals</h2>
              <p className={styles.dealSubtext}>Good finds move quickly around campus.</p>
              {flashItems.length ? (
                <div className={styles.dealProduct}>
                  <img src={flashItems[0].image} alt={flashItems[0].title} />
                  <div><span className={styles.dealTag}>{flashItems[0].tag}</span><strong>{flashItems[0].title}</strong><span>{formatNaira(flashItems[0].price)}</span></div>
                </div>
              ) : (
                <p className={styles.emptyNotice}>No flash deals available yet.</p>
              )}
              {flashItems.length > 0 && <div className={styles.dealTimer}><Zap size={14} /><span>Live flash sale</span></div>}
              <Link href="/explore?sort=deals" className={styles.dealLink}>See all flash sales <ArrowRight size={14} /></Link>
            </aside>
          </div>
        </div>
      </section>

      <div className="container-wide">
        <section className={styles.trustBar} aria-label="MasterCart benefits">
          <div><ShieldCheck size={19} /><span><strong>Escrow protected</strong> Payments stay safe</span></div>
          <div><Truck size={19} /><span><strong>Campus delivery</strong> Fast, familiar, nearby</span></div>
          <div><CheckCircle2 size={19} /><span><strong>Verified stores</strong> Shop with confidence</span></div>
          <div><Heart size={19} /><span><strong>Easy returns</strong> 24h return window</span></div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}><div><span className={styles.sectionEyebrow}>MOVE FAST</span><h2>Flash sale</h2></div><Link href="/explore?sort=deals" className={styles.textLink}>See all deals <ArrowRight size={15} /></Link></div>
          <div className={styles.productRail}>
            {flashItems.length ? flashItems.map((item) => (
              <Link href="/explore" className={styles.saleCard} key={item.title}>
                <div className={styles.saleImageWrap}><img src={item.image} alt={item.title} /><span>{item.tag}</span><button type="button" className="btn btn-icon btn-ghost" style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff' }} aria-label={`Save ${item.title}`}><Heart size={15} /></button></div>
                <div className={styles.saleInfo}><span>{item.brand}</span><h3>{item.title}</h3><div><strong>{formatNaira(item.price)}</strong><del>{formatNaira(item.oldPrice)}</del></div></div>
              </Link>
            )) : <p className={styles.emptyNotice}>No products available yet.</p>}
          </div>
        </section>

        <section className={styles.sectionCompact}>
          <div className={styles.sectionHead}><div><span className={styles.sectionEyebrow}>ON YOUR RADAR</span><h2>Trending on campus</h2></div><Link href="/explore?sort=trending" className={styles.textLink}>Explore trending <ArrowRight size={15} /></Link></div>
          <div className={styles.storyRail}>
            {trendingProducts.length ? trendingProducts.map((product, index) => {
              const image = product.media_urls?.[0] || product.image_url;
              const brand = product.brands?.name || 'Verified campus store';
              return <Link href={`/product/${product.id}`} className={`${styles.storyCard} ${styles[`story${['light', 'dark', 'warm', 'green'][index % 4]}`]}`} key={product.id}>
                {image ? <img src={image} alt={product.title} /> : <div className={styles.imageUnavailable}>Image unavailable</div>}
                <div className={styles.storyShade} /><div className={styles.storyContent}><span>{brand}</span><h3>{product.title}</h3><span className={styles.storyArrow}><ArrowRight size={15} /></span></div>
              </Link>;
            }) : <p className={styles.emptyNotice}>No trending products available yet.</p>}
          </div>
        </section>

        <section className={styles.sectionCompact}>
          <div className={styles.sectionHead}><div><span className={styles.sectionEyebrow}>WATCH WHAT&apos;S NEXT</span><h2>MasterCart reels</h2></div><Link href="/reels" className={styles.textLink}>Watch full feed <ArrowRight size={15} /></Link></div>
          <div className={styles.reelRail}>
            {allReels.length ? allReels.slice(0, 4).map((reel, index) => {
              const image = reel.cover_url || reel.thumbnail_url;
              const title = reel.title || 'Campus Reel';
              const brand = reel.brands?.name || 'Verified Store';
              return (
                <Link href="/reels" className={styles.reelCard} key={reel.id}>
                  <div className={styles.reelMedia}>
                    {image ? (
                      <img src={image} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div className={styles.reelUnavailable} style={{ background: 'linear-gradient(135deg, #18181b 0%, #09090b 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a1a1aa' }}>
                        <Video size={28} style={{ opacity: 0.6 }} />
                      </div>
                    )}
                    <span className={styles.reelPlay}><Play size={16} fill="currentColor" /></span>
                  </div>
                  <div className={styles.reelMeta}>
                    <span className={styles.brandAvatar}>{brand.slice(0, 1)}</span>
                    <div><strong>{title}</strong><span>{brand}</span></div>
                  </div>
                </Link>
              );
            }) : <p className={styles.emptyNotice}>No reels available yet.</p>}
          </div>
        </section>

        <DynamicMerchandising />
        <DelicaciesPreview universityId={userUniversityId} />

        <section className={styles.section}>
          <div className={styles.sectionHead}><div><span className={styles.sectionEyebrow}>CURATED FOR YOU</span><h2>Popular right now</h2></div><Link href="/explore" className={styles.textLink}>View marketplace <ArrowRight size={15} /></Link></div>
          <div className={styles.productGrid}>
            {renderableProducts.length ? renderableProducts.map((product) => <ProductCard key={product.id} product={product} />) : <p className={styles.emptyNotice}>No products available yet.</p>}
          </div>
          {!isInitialized && <p className={styles.loadingNote}>Curating the freshest campus finds for you...</p>}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}><div><span className={styles.sectionEyebrow}>TRUSTED LOCALLY</span><h2>Popular campus stores</h2></div><Link href="/vendors" className={styles.textLink}>See all stores <ArrowRight size={15} /></Link></div>
          <div className={styles.vendorGrid}>
            {featuredVendors.length ? featuredVendors.map((vendor) => <VendorCard key={vendor.id} vendor={vendor} />) : <p className={styles.emptyNotice}>No vendors available yet.</p>}
          </div>
        </section>

        <section className={styles.ctaBanner}>
          <div><span className={styles.sectionEyebrow}>FOR THE NEXT GENERATION</span><h2>Your campus has a story.<br /><em>Put your brand in it.</em></h2><p>Join verified student entrepreneurs selling to a campus that already gets it.</p></div>
          <Link href="/onboarding" className={styles.primaryButton}>Open your store <ArrowRight size={16} /></Link>
          <div className={styles.ctaGlow} />
        </section>
      </div>
    </main>
  );
}

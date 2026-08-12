'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Heart,
  MapPin,
  Play,
  ShieldCheck,
  Star,
  Truck,
  Zap,
} from 'lucide-react';
import ProductCard, { LiveProduct } from '@/components/ProductCard';
import VendorCard, { LiveVendor } from '@/components/VendorCard';
import { useMarketplaceStore } from '@/store/marketplaceStore';
import { supabase } from '@/lib/supabase';
import styles from './page.module.css';
import DynamicMerchandising from '@/components/DynamicMerchandising';
import DelicaciesPreview from '@/components/DelicaciesPreview';

const formatNaira = (value: number) => `₦${new Intl.NumberFormat('en-NG').format(value)}`;

// No fallback mock products; real database records are queried exclusively.

const categoryLinks = [
  ['Fashion', '01'],
  ['Electronics', '02'],
  ['Gadgets', '03'],
  ['Beauty', '04'],
  ['Home & Living', '05'],
  ['Services', '06'],
];

const campusStories = [
  { title: "Freshers' edit", note: 'Looks for your first week', image: '/curated/campus-fashion.jpeg', tone: 'light' },
  { title: 'Sneaker rotation', note: 'The pair everyone wants', image: '/curated/white-sneaker.webp', tone: 'dark' },
  { title: 'Made on campus', note: 'Meet the next-gen brands', image: '/curated/campus-style.jpg', tone: 'warm' },
  { title: 'The everyday edit', note: 'Small upgrades, big impact', image: '/curated/campus-market.jpg', tone: 'green' },
];

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

  const featuredVendors = useMemo(() => {
    return allBrands.filter((vendor) => !vendor.marketplace_type || vendor.marketplace_type === 'fashion').slice(0, 4) as unknown as LiveVendor[];
  }, [allBrands]);

  const flashItems = useMemo(() => {
    const saleProducts = allProducts.filter((product) => !product.is_draft && (!product.product_section || product.product_section === 'fashion') && ((product.original_price || 0) > (product.price || 0) || (product as unknown as { is_flash_sale?: boolean }).is_flash_sale)).slice(0, 5);
    return saleProducts.map((product) => ({
      title: product.title,
      brand: product.brands?.name || 'Verified campus store',
      price: Number(product.price || 0),
      oldPrice: Number(product.original_price || product.price || 0),
      image: product.media_urls?.[0] || '/logo.png',
      tag: product.original_price ? `-${Math.round(((product.original_price - product.price) / product.original_price) * 100)}%` : 'Deal',
    }));
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
                {categoryLinks.map(([label, number], index) => (
                  <Link href={`/explore?category=${label}`} className={`${styles.categoryLink} ${index === 0 ? styles.categoryLinkActive : ''}`} key={label}>
                    <span>{label}</span>
                    <span className={styles.categoryNumber}>{number}</span>
                    <ChevronRight size={15} />
                  </Link>
                ))}
              </nav>
              <Link href="/explore" className={styles.browseAll}>View all categories <ArrowRight size={14} /></Link>
            </aside>

            <div className={styles.heroCard}>
              <img className={styles.heroImage} src="/curated/campus-style.jpg" alt="Students expressing personal style on campus" />
              <div className={styles.heroOverlay} />
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
                <div><strong>2.4k+</strong><span>campus finds</span></div>
                <div><strong>86</strong><span>verified stores</span></div>
              </div>
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
              <div className={styles.dealTimer}><Clock3 size={14} /><span>Ends in</span><strong>04h 28m</strong></div>
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
                <div className={styles.saleImageWrap}><img src={item.image} alt={item.title} /><span>{item.tag}</span><button type="button" aria-label={`Save ${item.title}`}><Heart size={15} /></button></div>
                <div className={styles.saleInfo}><span>{item.brand}</span><h3>{item.title}</h3><div><strong>{formatNaira(item.price)}</strong><del>{formatNaira(item.oldPrice)}</del></div></div>
              </Link>
            )) : <p className={styles.emptyNotice}>No products available yet.</p>}
          </div>
        </section>

        <section className={styles.sectionCompact}>
          <div className={styles.sectionHead}><div><span className={styles.sectionEyebrow}>ON YOUR RADAR</span><h2>Trending on campus</h2></div><Link href="/explore?sort=trending" className={styles.textLink}>Explore trending <ArrowRight size={15} /></Link></div>
          <div className={styles.storyRail}>
            {campusStories.map((story) => (
              <Link href="/explore" className={`${styles.storyCard} ${styles[`story${story.tone}`]}`} key={story.title}>
                <img src={story.image} alt={story.title} /><div className={styles.storyShade} /><div className={styles.storyContent}><span>{story.note}</span><h3>{story.title}</h3><span className={styles.storyArrow}><ArrowRight size={15} /></span></div>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.sectionCompact}>
          <div className={styles.sectionHead}><div><span className={styles.sectionEyebrow}>WATCH WHAT&apos;S NEXT</span><h2>MasterCart reels</h2></div><Link href="/reels" className={styles.textLink}>Watch full feed <ArrowRight size={15} /></Link></div>
          <div className={styles.reelRail}>
            {allReels.length ? allReels.slice(0, 4).map((reel, index) => {
              const image = reel.thumbnail_url || '/logo.png';
              const title = reel.title || 'Campus Reel';
              const brand = reel.brands?.name || 'Verified Store';
              return <Link href="/reels" className={styles.reelCard} key={reel.id}><div className={styles.reelMedia}><img src={image} alt={title} /><span className={styles.reelPlay}><Play size={16} fill="currentColor" /></span><span className={styles.reelDuration}>0{index + 1}:20</span></div><div className={styles.reelMeta}><span className={styles.brandAvatar}>{brand.slice(0, 1)}</span><div><strong>{title}</strong><span>{brand}</span></div></div></Link>;
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

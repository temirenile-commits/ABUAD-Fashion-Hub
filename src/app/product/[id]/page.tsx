import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  MessageCircle,
  Star,
  Heart,
  ShieldCheck,
  Package,
  CheckCircle,
  Eye,
  Trophy,
} from 'lucide-react';
import ShareProductButton from '@/components/ShareProductButton';
import { supabaseAdmin } from '@/lib/supabase-admin';
import ProductCard, { LiveProduct } from '@/components/ProductCard';
import ProductInteraction from '@/components/ProductInteraction';
import ViewTracker from '@/components/ViewTracker';
import ProductViewTracker from '@/components/ProductViewTracker';
import ProfileViewTracker from '@/components/ProfileViewTracker';
import { formatPrice, getDiscount } from '@/lib/utils';
import ProductEnquiry from '@/components/ProductEnquiry';
import WishlistButton from '@/components/WishlistButton';
import ReviewSection from '@/components/ReviewSection';
import VendorActions from '@/app/vendor/[slug]/VendorActions';
import CountdownTimer from '@/components/CountdownTimer';
import styles from './product.module.css';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  let { data: product, error: metaError } = await supabaseAdmin
    .from('products')
    .select('title, description, image_url, media_urls, is_preorder, preorder_arrival_date, variants')
    .eq('id', id)
    .single();

  if (metaError && metaError.message.includes('schema cache')) {
    const fallback = await supabaseAdmin
      .from('products')
      .select('title, description, image_url, media_urls')
      .eq('id', id)
      .single();
    product = fallback.data as any;
  }

  if (!product) return { title: 'Product Not Found' };
  
  const ogImage = product.image_url || product.media_urls?.[0] || 'https://images.unsplash.com/photo-1542272201-b1ca555f8505?w=500';

  return {
    title: product.title,
    description: product.description,
    openGraph: {
      title: product.title,
      description: product.description,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: product.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: product.title,
      description: product.description,
      images: [ogImage],
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;

  // Fetch product with brand details
  const { data: productData, error } = await supabaseAdmin
    .from('products')
    .select(`
      *,
      brands (
        id,
        owner_id,
        name,
        verified,
        whatsapp_number,
        logo_url
      )
    `)
    .eq('id', id)
    .single();

  if (error || !productData) notFound();

  // Fetch real-time stats
  const { data: statsData } = await supabaseAdmin
    .from('product_stats')
    .select('*')
    .eq('product_id', id)
    .single();

  const product = productData as unknown as LiveProduct;
  const vendor = product.brands;
  const stats = statsData || { avg_rating: 0, review_count: 0, wishlist_count: 0 };
  
  const discount = product.original_price
    ? getDiscount(product.price, product.original_price)
    : null;

  // Fetch related products (same category and same marketplace ecosystem)
  const { data: relatedData } = await supabaseAdmin
    .from('products')
    .select(`
      *,
      brands (id, owner_id, name, whatsapp_number)
    `)
    .eq('product_section', productData.product_section)
    .eq('category', product.category)
    .neq('id', product.id)
    .limit(4);

  const relatedProducts = (relatedData || []) as unknown as LiveProduct[];

  const waMessage = `Hi! I'm interested in: *${product.title}* priced at *${formatPrice(product.price)}* from Master Cart. Is it available?`;
  const normalizeNgPhone = (num: string) => {
    const digits = (num || '').replace(/\D/g, '');
    if (digits.startsWith('234')) return digits;
    if (digits.startsWith('0')) return '234' + digits.slice(1);
    if (digits.length === 10) return '234' + digits;
    return digits || '2348000000000';
  };
  const whatsappNumber = normalizeNgPhone(vendor?.whatsapp_number || '');

  const mainImage = product.image_url || product.media_urls?.[0] || 'https://images.unsplash.com/photo-1542272201-b1ca555f8505?w=500&auto=format&fit=crop&q=60';
  const allImages = [...(product.image_url ? [product.image_url] : []), ...(product.media_urls || [])].filter((val, i, arr) => arr.indexOf(val) === i);

  return (
    <main className="container">
      <ViewTracker category={product.category || 'Clothing'} />
      <ProductViewTracker productId={product.id} />
      <ProfileViewTracker brandId={vendor.id} />
      <div className={styles.page}>
        {/* Breadcrumb */}
        <nav className={styles.breadcrumb}>
          <Link href="/">Home</Link>
          <span>/</span>
          <Link href="/explore">Explore</Link>
          <span>/</span>
          <span>{product.title}</span>
        </nav>

        {/* Product Main */}
        <div className={styles.productMain}>
          {/* Image/Video Gallery */}
          <div className={styles.gallery}>
            <div className={styles.mainImg}>
              <div className={styles.visualContainer} style={{ position: 'relative', width: '100%', height: '100%' }}>
                {product.video_url ? (
                  <video 
                    controls 
                    className={styles.videoPlayer} 
                    poster={mainImage}
                    autoPlay
                    muted
                  >
                    <source src={product.video_url} type="video/mp4" />
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <div className={styles.imageWrapper}>
                    <Image
                      src={mainImage}
                      alt={product.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      priority
                      className={styles.mainImgEl}
                    />
                  </div>
                )}
                
                <ShareProductButton
                  productId={product.id}
                  productTitle={product.title}
                  className={styles.downloadBtn}
                />
              </div>

              {discount && discount > 0 ? (
                <span className={`badge badge-flash ${styles.imgDiscount}`}>
                  -{discount}% OFF
                </span>
              ) : null}
            </div>

            {allImages.length > 1 && (
              <div className={styles.thumbs}>
                {allImages.map((img, i) => (
                  <div key={i} className={`${styles.thumb} ${img === mainImage ? styles.thumbActive : ''}`}>
                    <Image src={img} alt={`${product.title} ${i + 1}`} fill sizes="80px" className={styles.thumbImg} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info Panel */}
          <div className={styles.infoPanel}>
            {/* Brand */}
            <div className={styles.brandRow} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Link href={`/vendor/${vendor.name.toLowerCase().replace(/\s+/g, '-')}?id=${vendor.id}`} className={styles.brandLink}>
                  {vendor.name}
                </Link>
                {vendor.verified && <CheckCircle size={14} className="verified-icon" />}
              </div>
              <VendorActions 
                vendorId={vendor.id} 
                vendorName={vendor.name} 
                whatsappNumber={vendor.whatsapp_number}
                initialFollowers={0}
                minimal
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h1 className={styles.productTitle}>{product.title}</h1>
              {product.is_preorder && (
                <span className="badge" style={{ background: 'var(--primary)', color: '#000', fontWeight: 700, padding: '4px 8px', borderRadius: '4px' }}>
                  PRE-ORDER
                </span>
              )}
              {product.award_history && (product.award_history as any[]).length > 0 && (
                <div className="badge badge-gold" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px' }}>
                  <Trophy size={12} /> {(product.award_history as any[])[0].title}
                </div>
              )}
            </div>
            
            {product.is_preorder && product.preorder_arrival_date && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-400)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  Pre-order Countdown:
                </div>
                <CountdownTimer expiryDate={product.preorder_arrival_date} />
              </div>
            )}

            {/* Rating Section (Real-time) */}
            <div className={styles.ratingRow}>
              <div className="stars">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    size={14}
                    fill={s <= Math.round(stats.avg_rating) ? 'var(--primary)' : 'none'}
                    color={s <= Math.round(stats.avg_rating) ? 'var(--primary)' : '#444'}
                  />
                ))}
              </div>
              <span className={styles.ratingNum}>{stats.avg_rating || '0.0'}</span>
              <span className={styles.ratingCount}>{stats.review_count} reviews</span>
              <span className={styles.sold}>{product.sales_count || 0} sold</span>
              <span className={styles.views} style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: 0.6 }}>
                <Eye size={14} /> {product.views_count || 0} views
              </span>
              <span style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '4px', 
                color: (product.stock_count || 0) > 0 ? '#10b981' : '#ef4444', 
                fontWeight: 700,
                fontSize: '0.85rem',
                marginLeft: '8px'
              }}>
                {(product.stock_count || 0) > 0 ? `?? ${product.stock_count} in stock` : '?? Out of stock'}
              </span>
            </div>

            {/* Price */}
            <div className={styles.priceBlock}>
              <span className={styles.price}>{formatPrice(product.price)}</span>
              {product.original_price && product.original_price > product.price && (
                <>
                  <span className={styles.originalPrice}>
                    {formatPrice(product.original_price)}
                  </span>
                  <span className={`badge badge-flash`}>Save {discount}%</span>
                </>
              )}
            </div>

            {/* Description */}
            <p className={styles.description}>{product.description}</p>

            {/* Location Availability */}
            {product.location_availability && (
              <div className={styles.locationBadge} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.5rem 0', color: 'var(--primary)', fontSize: '0.85rem', fontWeight: 600 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(245, 158, 11, 0.1)', padding: '4px 10px', borderRadius: '6px' }}>
                   📍 {product.location_availability}
                </span>
              </div>
            )}

            {/* Trust badges */}
            <div className={styles.trustBadges}>
              <div className={styles.trustItem}>
                <ShieldCheck size={16} className={styles.trustIcon} />
                <span>Verified Campus Seller</span>
              </div>
              <div className={styles.trustItem}>
                <Package size={16} className={styles.trustIcon} />
                <span>Campus Delivery Available</span>
              </div>
            </div>

            {/* Interaction (Cart/Buy) */}
            <ProductInteraction product={product} />

            {/* Enquiry Section */}
            <div id="enquiry">
              <ProductEnquiry 
                productId={product.id}
                productTitle={product.title}
                vendorId={vendor.owner_id}
                vendorName={vendor.name}
              />
            </div>

            {/* Support CTA (WhatsApp only as fallback) */}
            <div className={styles.supportCtas}>
              <div className={styles.secondaryActions}>
                <a
                  href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(waMessage)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost btn-sm"
                  title="WhatsApp Alternative"
                  style={{ gap: '0.5rem', opacity: 0.7 }}
                >
                  <MessageCircle size={16} style={{ color: '#25D366' }} />
                  Inquiry via WhatsApp
                </a>
                <WishlistButton productId={product.id} className="btn btn-ghost btn-icon" size={18} />
              </div>
            </div>

            {/* Vendor Card Mini */}
              <Link href={`/vendor/${vendor.name.toLowerCase().replace(/\s+/g, '-')}?id=${vendor.id}`} className={styles.vendorMini}>
                <div className={styles.vendorMiniLogo}>
                  {vendor.logo_url ? (
                    <Image src={vendor.logo_url} alt={vendor.name} fill style={{objectFit: 'cover'}} />
                  ) : (
                    vendor.name.substring(0, 2).toUpperCase()
                  )}
                </div>
                <div className={styles.vendorMiniInfo}>
                  <div className={styles.vendorMiniName}>
                    {vendor.name}
                    {vendor.verified && <CheckCircle size={13} className="verified-icon" />}
                  </div>
                  <p className={styles.vendorMiniStats}>
                    Official Vendor Store • Visit Profile
                  </p>
                </div>
                <span className={styles.vendorMiniArrow}>→</span>
              </Link>
          </div>
        </div>

        {/* Real Customer Reviews Section */}
        <div id="reviews">
          <ReviewSection productId={product.id} />
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <section className={styles.related}>
            <h2 className={styles.relatedTitle}>More from {product.category}</h2>
            <div className={styles.relatedGrid}>
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

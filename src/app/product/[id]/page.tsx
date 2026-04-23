import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  MessageCircle,
  Star,
  Heart,
  Share2,
  ShieldCheck,
  Package,
  CheckCircle,
} from 'lucide-react';
import { supabaseAdmin } from '@/lib/supabase-admin';
import ProductCard, { LiveProduct } from '@/components/ProductCard';
import ProductInteraction from '@/components/ProductInteraction';
import ViewTracker from '@/components/ViewTracker';
import { formatPrice, getDiscount } from '@/lib/utils';
import ProductEnquiry from '@/components/ProductEnquiry';
import styles from './product.module.css';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const { data: product } = await supabaseAdmin
    .from('products')
    .select('title, description')
    .eq('id', id)
    .single();

  if (!product) return { title: 'Product Not Found' };
  return {
    title: product.title,
    description: product.description,
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

  const product = productData as unknown as LiveProduct;
  const vendor = product.brands;
  
  const discount = product.original_price
    ? getDiscount(product.price, product.original_price)
    : null;

  // Fetch related products (same category)
  const { data: relatedData } = await supabaseAdmin
    .from('products')
    .select(`
      *,
      brands (id, owner_id, name, whatsapp_number)
    `)
    .eq('category', product.category)
    .neq('id', product.id)
    .limit(4);

  const relatedProducts = (relatedData || []) as unknown as LiveProduct[];

  const waMessage = `Hi! I'm interested in: *${product.title}* priced at *${formatPrice(product.price)}* from ABUAD Fashion Hub. Is it available?`;
  const whatsappNumber = vendor?.whatsapp_number?.replace('+', '') || '';

  const mainImage = product.image_url || product.media_urls?.[0] || 'https://images.unsplash.com/photo-1542272201-b1ca555f8505?w=500&auto=format&fit=crop&q=60';
  const allImages = [...(product.image_url ? [product.image_url] : []), ...(product.media_urls || [])].filter((val, i, arr) => arr.indexOf(val) === i);

  return (
    <main className="container">
      <ViewTracker category={product.category || 'Clothing'} />
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
                <Image
                  src={mainImage}
                  alt={product.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority
                  className={styles.mainImgEl}
                />
              )}
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
            <div className={styles.brandRow}>
              <Link href={`/vendor/${vendor.name.toLowerCase().replace(/\s+/g, '-')}?id=${vendor.id}`} className={styles.brandLink}>
                {vendor.name}
              </Link>
              {vendor.verified && <CheckCircle size={14} className="verified-icon" />}
            </div>

            <h1 className={styles.productTitle}>{product.title}</h1>

            {/* Rating Placeholder */}
            <div className={styles.ratingRow}>
              <div className="stars">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    size={14}
                    fill={s <= 4 ? 'currentColor' : 'none'}
                    className={s <= 4 ? 'star-filled' : 'star-empty'}
                  />
                ))}
              </div>
              <span className={styles.ratingNum}>4.5</span>
              <span className={styles.ratingCount}>12 reviews</span>
              <span className={styles.sold}>5 sold</span>
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
                <button className="btn btn-ghost btn-icon" aria-label="Wishlist">
                  <Heart size={18} />
                </button>
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
                  Visit Store
                </p>
              </div>
              <span className={styles.vendorMiniArrow}>→</span>
            </Link>
          </div>
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

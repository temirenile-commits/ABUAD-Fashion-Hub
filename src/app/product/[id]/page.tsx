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
  ArrowLeft,
  CheckCircle,
} from 'lucide-react';
import { PRODUCTS, VENDORS, formatPrice, getDiscount } from '@/lib/data';
import ProductCard from '@/components/ProductCard';
import styles from './product.module.css';

export async function generateStaticParams() {
  return PRODUCTS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = PRODUCTS.find((p) => p.id === id);
  if (!product) return { title: 'Product Not Found' };
  return {
    title: product.title,
    description: product.description,
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = PRODUCTS.find((p) => p.id === id);
  if (!product) notFound();

  const vendor = VENDORS.find((v) => v.id === product.brandId);
  const discount = product.originalPrice
    ? getDiscount(product.price, product.originalPrice)
    : null;

  const relatedProducts = PRODUCTS.filter(
    (p) => p.id !== product.id && p.category === product.category
  ).slice(0, 4);

  const waMessage = `Hi! I'm interested in: *${product.title}* priced at *${formatPrice(product.price)}* from ABUAD Fashion Hub. Is it available?`;

  return (
    <main className="container">
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
          {/* Image Gallery */}
          <div className={styles.gallery}>
            <div className={styles.mainImg}>
              <Image
                src={product.images[0]}
                alt={product.title}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
                className={styles.mainImgEl}
              />
              {discount && (
                <span className={`badge badge-flash ${styles.imgDiscount}`}>
                  -{discount}% OFF
                </span>
              )}
            </div>
            {product.images.length > 1 && (
              <div className={styles.thumbs}>
                {product.images.map((img, i) => (
                  <div key={i} className={`${styles.thumb} ${i === 0 ? styles.thumbActive : ''}`}>
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
              <Link href={vendor ? `/vendor/${vendor.slug}` : '#'} className={styles.brandLink}>
                {product.brand}
              </Link>
              {vendor?.verified && <CheckCircle size={14} className="verified-icon" />}
            </div>

            <h1 className={styles.productTitle}>{product.title}</h1>

            {/* Rating */}
            <div className={styles.ratingRow}>
              <div className="stars">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    size={14}
                    fill={s <= Math.round(product.rating) ? 'currentColor' : 'none'}
                    className={s <= Math.round(product.rating) ? 'star-filled' : 'star-empty'}
                  />
                ))}
              </div>
              <span className={styles.ratingNum}>{product.rating}</span>
              <span className={styles.ratingCount}>{product.reviews} reviews</span>
              <span className={styles.sold}>{product.sold} sold</span>
            </div>

            {/* Price */}
            <div className={styles.priceBlock}>
              <span className={styles.price}>{formatPrice(product.price)}</span>
              {product.originalPrice && (
                <>
                  <span className={styles.originalPrice}>
                    {formatPrice(product.originalPrice)}
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

            {/* CTA */}
            <div className={styles.ctaGroup}>
              <a
                href={`https://wa.me/${product.whatsapp}?text=${encodeURIComponent(waMessage)}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`btn btn-whatsapp btn-lg ${styles.waBtnFull}`}
              >
                <MessageCircle size={20} />
                Contact Seller on WhatsApp
              </a>

              <div className={styles.secondaryCtas}>
                <button className="btn btn-ghost btn-icon" aria-label="Wishlist">
                  <Heart size={18} />
                </button>
                <button className="btn btn-ghost btn-icon" aria-label="Share">
                  <Share2 size={18} />
                </button>
              </div>
            </div>

            {/* Vendor Card Mini */}
            {vendor && (
              <Link href={`/vendor/${vendor.slug}`} className={styles.vendorMini}>
                <div className={styles.vendorMiniLogo}>{vendor.logo}</div>
                <div className={styles.vendorMiniInfo}>
                  <div className={styles.vendorMiniName}>
                    {vendor.name}
                    {vendor.verified && <CheckCircle size={13} className="verified-icon" />}
                  </div>
                  <p className={styles.vendorMiniStats}>
                    {vendor.products} products · ⭐ {vendor.rating}
                  </p>
                </div>
                <span className={styles.vendorMiniArrow}>→</span>
              </Link>
            )}
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

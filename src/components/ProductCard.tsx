'use client';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, Star, MessageCircle } from 'lucide-react';
import { Product, formatPrice, getDiscount } from '@/lib/data';
import styles from './ProductCard.module.css';

interface Props {
  product: Product;
}

export default function ProductCard({ product }: Props) {
  const discount = product.originalPrice
    ? getDiscount(product.price, product.originalPrice)
    : null;

  return (
    <Link href={`/product/${product.id}`} className={styles.card}>
      {/* Image */}
      <div className={styles.imageWrap}>
        <Image
          src={product.image}
          alt={product.title}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className={styles.image}
        />

        {/* Overlays */}
        <div className={styles.overlays}>
          {discount && (
            <span className={`badge badge-flash ${styles.discountBadge}`}>
              -{discount}%
            </span>
          )}
          {product.trending && !discount && (
            <span className={`badge badge-brand ${styles.discountBadge}`}>
              🔥 Hot
            </span>
          )}
        </div>

        {/* Wishlist */}
        <button
          className={styles.wishlistBtn}
          aria-label="Add to wishlist"
          onClick={(e) => e.preventDefault()}
        >
          <Heart size={16} />
        </button>

        {/* Hover overlay */}
        <div className={styles.hoverOverlay}>
          <span className={styles.quickView}>Quick View</span>
        </div>
      </div>

      {/* Info */}
      <div className={styles.info}>
        <p className={styles.brand}>{product.brand}</p>
        <h3 className={styles.title}>{product.title}</h3>

        {/* Rating */}
        <div className={styles.ratingRow}>
          <Star size={12} fill="currentColor" className="star-filled" />
          <span className={styles.ratingNum}>{product.rating}</span>
          <span className={styles.ratingCount}>({product.reviews})</span>
          <span className={styles.sold}>{product.sold} sold</span>
        </div>

        {/* Price */}
        <div className={styles.priceRow}>
          <span className={styles.price}>{formatPrice(product.price)}</span>
          {product.originalPrice && (
            <span className={styles.originalPrice}>
              {formatPrice(product.originalPrice)}
            </span>
          )}
        </div>

        {/* CTA */}
        <div className={styles.cta}>
          <a
            href={`https://wa.me/${product.whatsapp}?text=Hi! I'm interested in: ${encodeURIComponent(product.title)} (${formatPrice(product.price)}) from ABUAD Fashion Hub.`}
            target="_blank"
            rel="noopener noreferrer"
            className={`btn btn-whatsapp btn-sm ${styles.waBtn}`}
            onClick={(e) => e.stopPropagation()}
          >
            <MessageCircle size={14} /> Contact Seller
          </a>
        </div>
      </div>
    </Link>
  );
}

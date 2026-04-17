'use client';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, Star, MessageCircle, ShoppingBag } from 'lucide-react';
import styles from './ProductCard.module.css';

import { formatPrice, getDiscount } from '@/lib/utils';
import { useCart } from '@/context/CartContext';

// Joined Database Type Structure
export interface LiveProduct {
  id: string;
  brand_id: string;
  title: string;
  description: string;
  price: number;
  original_price: number | null;
  category: string;
  media_urls: string[];
  is_featured: boolean;
  locked: boolean;
  video_url?: string;
  stock_count: number;
  views_count: number;
  sales_count: number;
  boost_level: number;
  brands: {
    id: string;
    owner_id: string;
    name: string;
    whatsapp_number: string;
    verified: boolean;
    logo_url?: string;
  };
  rating?: number;
  reviews?: number;
  sold?: number;
}

interface Props {
  product: LiveProduct;
}

export default function ProductCard({ product }: Props) {
  const { addToCart } = useCart();
  const discount = product.original_price
    ? getDiscount(product.price, product.original_price)
    : null;

  const imageUrl = product.media_urls?.[0] || 'https://images.unsplash.com/photo-1542272201-b1ca555f8505?w=500&auto=format&fit=crop&q=60';
  const brandName = product.brands?.name || 'Unknown Brand';
  const whatsapp = product.brands?.whatsapp_number || '';

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product);
    // Notification or visual feedback could be added here
  };

  return (
    <Link href={`/product/${product.id}`} className={styles.card}>
      {/* ... (previous image section) */}
      <div className={styles.imageWrap}>
        <Image
          src={imageUrl}
          alt={product.title}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className={styles.image}
        />

        {/* Overlays */}
        <div className={styles.overlays}>
          {discount && discount > 0 ? (
            <span className={`badge badge-flash ${styles.discountBadge}`}>
              -{discount}%
            </span>
          ) : null}
        </div>

        {/* Add to Cart Quick Access */}
        <button
          className={styles.addToCartQuick}
          aria-label="Add to cart"
          onClick={handleAddToCart}
        >
          <ShoppingBag size={18} />
        </button>

        {/* Wishlist */}
        <button
          className={styles.wishlistBtn}
          aria-label="Add to wishlist"
          onClick={(e) => e.preventDefault()}
        >
          <Heart size={16} />
        </button>
      </div>

      {/* Info */}
      <div className={styles.info}>
        <p className={styles.brand}>{brandName}</p>
        <h3 className={styles.title}>{product.title}</h3>

        {/* Price */}
        <div className={styles.priceRow}>
          <span className={styles.price}>{formatPrice(product.price)}</span>
          {product.original_price && product.original_price > product.price && (
            <span className={styles.originalPrice}>
              {formatPrice(product.original_price)}
            </span>
          )}
        </div>

        {/* CTA */}
        <div className={styles.cta}>
          <button
            onClick={handleAddToCart}
            className={`btn btn-primary btn-sm ${styles.cartButton}`}
          >
            <ShoppingBag size={14} /> Add to Cart
          </button>
          
          <Link
            href={`/product/${product.id}#enquiry`}
            onClick={(e) => e.stopPropagation()}
            className={`btn btn-secondary btn-sm ${styles.chatButton}`}
          >
            <MessageCircle size={14} /> Enquire
          </Link>
        </div>
      </div>
    </Link>
  );
}

'use client';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, Star, MessageCircle, ShoppingBag, ShieldCheck } from 'lucide-react';
import styles from './ProductCard.module.css';

import { formatPrice, getDiscount } from '@/lib/utils';
import { useCart } from '@/context/CartContext';
import WishlistButton from '@/components/WishlistButton';

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
  image_url?: string;
  video_url?: string;
  is_featured: boolean;
  locked: boolean;
  created_at?: string;
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

  const imageUrl = product.image_url || product.media_urls?.[0] || 'https://images.unsplash.com/photo-1542272201-b1ca555f8505?w=500&auto=format&fit=crop&q=60';
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
      <div className={styles.imageWrap}>
        {imageUrl.toLowerCase().match(/\.(mp4|webm|mov|ogg)$/) || imageUrl.includes('video') ? (
          <video 
            src={imageUrl} 
            className={styles.image} 
            muted 
            autoPlay 
            loop 
            playsInline 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <Image
            src={imageUrl}
            alt={product.title}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className={styles.image}
          />
        )}

        {product.stock_count === 0 && (
          <div className={styles.soldOutBadge}>Sold Out</div>
        )}

        {discount && discount > 0 && product.stock_count > 0 && (
          <span className={styles.discountBadge}>-{discount}%</span>
        )}

        {product.brands?.verified && (
          <div className={styles.verifiedBadge}>
            <ShieldCheck size={10} /> Official
          </div>
        )}

        <WishlistButton productId={product.id} />
      </div>

      <div className={styles.info}>
        <h3 className={styles.title}>{product.title}</h3>
        <div className={styles.priceRow}>
          <span className={styles.price}>{formatPrice(product.price)}</span>
          {product.original_price && product.original_price > product.price && (
            <span className={styles.oldPrice}>{formatPrice(product.original_price)}</span>
          )}
        </div>

        <div className={styles.footer}>
          <div className={styles.rating}>
            <Star size={10} fill="currentColor" />
            <span>{product.rating || 4.5}</span>
          </div>
          {product.stock_count > 0 ? (
            <button
              className={styles.quickAdd}
              onClick={handleAddToCart}
              aria-label="Add to cart"
            >
              <ShoppingBag size={14} />
            </button>
          ) : (
            <span className={styles.outOfStockText}>Out of Stock</span>
          )}
        </div>
      </div>
    </Link>
  );
}

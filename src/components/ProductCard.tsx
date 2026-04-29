'use client';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, Star, MessageCircle, ShoppingBag, ShieldCheck, Download, Play, MoreVertical } from 'lucide-react';
import styles from './ProductCard.module.css';

import { formatPrice, getDiscount } from '@/lib/utils';
import { useCart } from '@/context/CartContext';
import WishlistButton from '@/components/WishlistButton';
import VividVideo from '@/components/VividVideo';

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

  // DEEP SEARCH: Find the first actual video in all media fields (including image_url if misclassified)
  const isVideoExt = (url: string) => url.toLowerCase().match(/\.(mp4|webm|mov|ogg)$/) || url.toLowerCase().includes('video') || url.toLowerCase().includes('reel');
  
  const detectedVideo = product.video_url || 
                        (product.image_url && isVideoExt(product.image_url) ? product.image_url : null) ||
                        product.media_urls?.find(url => isVideoExt(url));
  
  const isVideo = !!detectedVideo;
  
  // If we have a video, it becomes the main "imageUrl" for the card logic if needed
  const displayUrl = detectedVideo || product.image_url || product.media_urls?.[0] || 'https://images.unsplash.com/photo-1542272201-b1ca555f8505?w=500&auto=format&fit=crop&q=60';

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product);
    // Notification or visual feedback could be added here
  };

  return (
    <Link href={`/product/${product.id}`} className={`${styles.card} ${isVideo ? styles.videoCard : ''}`}>
      <div className={styles.imageWrap}>
        {isVideo && (
          <a 
            href={detectedVideo!} 
            download 
            target="_blank" 
            rel="noopener noreferrer"
            className={styles.downloadBtn}
            onClick={(e) => e.stopPropagation()}
            title="Download Video"
          >
            <Download size={14} />
          </a>
        )}
        {isVideo ? (
          <>
            <VividVideo 
              src={detectedVideo!} 
              className={styles.video} 
            />
            <div className={styles.playOverlay}>
              <Play size={24} fill="currentColor" />
            </div>
          </>
        ) : (
          <Image
            src={displayUrl}
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


      {isVideo ? (
        <div className={styles.info}>
          <div className={styles.videoAvatar}>
            {product.brands?.logo_url ? (
              <Image src={product.brands.logo_url} alt="" width={40} height={40} style={{ objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--primary)', color: '#000', fontWeight: 800 }}>
                {brandName.substring(0, 1)}
              </div>
            )}
          </div>
          <div className={styles.videoMeta}>
            <h3 className={styles.videoTitle}>{product.title}</h3>
            <div className={styles.videoStats}>
              <span>{brandName}</span>
              <span>•</span>
              <span>{formatPrice(product.price)}</span>
              <span>•</span>
              <div className={styles.rating} style={{ display: 'inline-flex' }}>
                <Star size={10} fill="currentColor" color="#EAB308" />
                <span>{product.rating ? Number(product.rating).toFixed(1) : '5.0'}</span>
              </div>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" style={{ padding: 0, opacity: 0.6 }}>
            <MoreVertical size={18} />
          </button>
        </div>
      ) : (
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
              <Star size={12} fill="currentColor" color="#EAB308" />
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{product.rating ? Number(product.rating).toFixed(1) : '5.0'}</span>
            </div>
            {product.stock_count > 0 ? (
              <button
                className={styles.quickAdd}
                onClick={handleAddToCart}
                aria-label="Add to cart"
              >
                <ShoppingBag size={16} />
              </button>
            ) : (
              <span className={styles.outOfStockText}>Out of Stock</span>
            )}
          </div>
        </div>
      )}
    </Link>
  );
}

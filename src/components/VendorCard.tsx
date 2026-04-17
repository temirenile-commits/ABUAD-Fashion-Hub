import Link from 'next/link';
import Image from 'next/image';
import { CheckCircle, Star, Package, Users } from 'lucide-react';
import styles from './VendorCard.module.css';

export interface LiveVendor {
  id: string;
  name: string;
  description: string;
  logo_url: string;
  whatsapp_number: string;
  verified: boolean;
  // Fallbacks for UI that we haven't built DB tracks for yet
  coverImage?: string; 
  category?: string;
  rating?: number;
  reviews?: number;
  followers?: string;
  // If we joined products
  products?: any[];
  instagram_link?: string;
  verification_status?: 'pending' | 'verified' | 'rejected' | 'suspended';
  wallet_balance?: number;
}

interface Props {
  vendor: LiveVendor;
  layout?: 'grid' | 'list';
}

export default function VendorCard({ vendor, layout = 'grid' }: Props) {
  const fallbackCover = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&auto=format&fit=crop';
  
  // Create a slug from the name
  const slug = vendor.name.toLowerCase().replace(/\s+/g, '-');
  
  // Get product count gracefully
  const productCount = vendor.products ? vendor.products.length : 0;

  return (
    <Link href={`/vendor/${slug}?id=${vendor.id}`} className={`${styles.card} ${layout === 'list' ? styles.list : ''}`}>
      {/* Cover */}
      <div className={styles.coverWrap}>
        <Image
          src={vendor.coverImage || fallbackCover}
          alt={vendor.name}
          fill
          sizes="(max-width: 768px) 100vw, 400px"
          className={styles.cover}
        />
        <div className={styles.coverGradient} />

        {/* Logo */}
        <div className={styles.logoWrap}>
          <span className={styles.logoText}>
            {vendor.logo_url && vendor.logo_url.startsWith('http') ? (
              <Image src={vendor.logo_url} alt={vendor.name} fill style={{objectFit: 'cover', borderRadius: '8px'}} />
            ) : (
              vendor.name.substring(0, 2).toUpperCase()
            )}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className={styles.body}>
        <div className={styles.nameRow}>
          <h3 className={styles.name}>{vendor.name}</h3>
          {vendor.verified && (
            <CheckCircle size={16} className="verified-icon" />
          )}
        </div>

        <span className={`badge badge-teal ${styles.categoryBadge}`}>
          {vendor.category || 'Fashion'}
        </span>

        <p className={styles.description}>{vendor.description}</p>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <Star size={12} fill="currentColor" className="star-filled" />
            <span>{vendor.rating || '4.8'}</span>
            <span className={styles.statSub}>({vendor.reviews || 0})</span>
          </div>
          <div className={styles.stat}>
            <Package size={12} />
            <span>{productCount || 0} items</span>
          </div>
          <div className={styles.stat}>
            <Users size={12} />
            <span>{vendor.followers || '1k'}</span>
          </div>
        </div>

        <span className={`btn btn-secondary btn-sm ${styles.viewBtn}`}>
          Visit Store →
        </span>
      </div>
    </Link>
  );
}

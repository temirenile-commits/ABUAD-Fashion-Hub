import Link from 'next/link';
import Image from 'next/image';
import { CheckCircle, Star, Package, Users } from 'lucide-react';
import { Vendor } from '@/lib/data';
import styles from './VendorCard.module.css';

interface Props {
  vendor: Vendor;
  layout?: 'grid' | 'list';
}

export default function VendorCard({ vendor, layout = 'grid' }: Props) {
  return (
    <Link href={`/vendor/${vendor.slug}`} className={`${styles.card} ${layout === 'list' ? styles.list : ''}`}>
      {/* Cover */}
      <div className={styles.coverWrap}>
        <Image
          src={vendor.coverImage}
          alt={vendor.name}
          fill
          sizes="(max-width: 768px) 100vw, 400px"
          className={styles.cover}
        />
        <div className={styles.coverGradient} />

        {/* Logo */}
        <div className={styles.logoWrap}>
          <span className={styles.logoText}>{vendor.logo}</span>
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
          {vendor.category}
        </span>

        <p className={styles.description}>{vendor.description}</p>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <Star size={12} fill="currentColor" className="star-filled" />
            <span>{vendor.rating}</span>
            <span className={styles.statSub}>({vendor.reviews})</span>
          </div>
          <div className={styles.stat}>
            <Package size={12} />
            <span>{vendor.products} items</span>
          </div>
          <div className={styles.stat}>
            <Users size={12} />
            <span>{vendor.followers}</span>
          </div>
        </div>

        <span className={`btn btn-secondary btn-sm ${styles.viewBtn}`}>
          Visit Store →
        </span>
      </div>
    </Link>
  );
}

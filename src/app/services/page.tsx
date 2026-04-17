import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { MessageCircle, Star, CheckCircle, Layers } from 'lucide-react';
import { SERVICES } from '@/lib/data';
import styles from './services.module.css';

export const metadata: Metadata = {
  title: 'Fashion Services',
  description: 'Book makeup artists, photographers, stylists, and tailors on ABUAD campus.',
};

const SERVICE_TYPES = [
  { label: 'All', value: 'all' },
  { label: 'Makeup Artists', value: 'Makeup Artist' },
  { label: 'Photographers', value: 'Photographer' },
  { label: 'Fashion Designers', value: 'Fashion Designer' },
  { label: 'Hair Stylists', value: 'Hair Stylist' },
];

export default function ServicesPage() {
  return (
    <main className="container">
      <div className={styles.page}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerIcon}>
            <Layers size={28} />
          </div>
          <div>
            <h1>Campus Fashion Services</h1>
            <p className={styles.subtitle}>
              Book talented campus creatives — makeup, photography, styling & more
            </p>
          </div>
        </div>

        {/* Type Filter Pills */}
        <div className={styles.typeFilter}>
          {SERVICE_TYPES.map((t) => (
            <span key={t.value} className={`${styles.typePill} ${t.value === 'all' ? styles.typeActive : ''}`}>
              {t.label}
            </span>
          ))}
        </div>

        {/* Services Grid */}
        <div className={styles.grid}>
          {SERVICES.map((svc) => {
            const waMessage = `Hi ${svc.brand}! I found you on ABUAD Fashion Hub and I'm interested in your service: *${svc.title}*. Please share more details.`;
            return (
              <div key={svc.id} className={styles.serviceCard}>
                {/* Image */}
                <div className={styles.imgWrap}>
                  <Image
                    src={svc.image}
                    alt={svc.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 340px"
                    className={styles.img}
                  />
                  <div className={styles.imgGradient} />
                  <span className={`badge badge-gold ${styles.typeBadge}`}>
                    {svc.serviceType}
                  </span>
                  {svc.verified && (
                    <div className={styles.verifiedBadge}>
                      <CheckCircle size={13} className="verified-icon" />
                      <span>Verified</span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className={styles.cardBody}>
                  <div className={styles.brandRow}>
                    <span className={styles.brandName}>{svc.brand}</span>
                    {svc.verified && <CheckCircle size={13} className="verified-icon" />}
                  </div>

                  <h3 className={styles.title}>{svc.title}</h3>
                  <p className={styles.description}>{svc.description}</p>

                  {/* Rating */}
                  <div className={styles.ratingRow}>
                    <div className="stars">
                      {[1,2,3,4,5].map((s) => (
                        <Star
                          key={s}
                          size={12}
                          fill={s <= Math.round(svc.rating) ? 'currentColor' : 'none'}
                          className={s <= Math.round(svc.rating) ? 'star-filled' : 'star-empty'}
                        />
                      ))}
                    </div>
                    <span className={styles.ratingNum}>{svc.rating}</span>
                    <span className={styles.ratingCount}>({svc.reviews} reviews)</span>
                  </div>

                  {/* Footer */}
                  <div className={styles.cardFooter}>
                    <div className={styles.pricing}>
                      <span className={styles.priceLabel}>Starting from</span>
                      <span className={styles.price}>{svc.price}</span>
                    </div>
                    <a
                      href={`https://wa.me/${svc.whatsapp}?text=${encodeURIComponent(waMessage)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`btn btn-whatsapp btn-sm`}
                    >
                      <MessageCircle size={14} /> Book Now
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA for Service Providers */}
        <div className={styles.providerCta}>
          <h2>Are you a Campus Creative?</h2>
          <p>List your makeup, photography, tailoring, or styling service on ABUAD Fashion Hub for free.</p>
          <Link href="/onboarding" className="btn btn-primary btn-lg">
            List Your Service Free
          </Link>
        </div>
      </div>
    </main>
  );
}

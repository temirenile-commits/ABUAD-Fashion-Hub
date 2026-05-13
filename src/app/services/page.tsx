'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { MessageCircle, Star, CheckCircle, Layers } from 'lucide-react';
import { useMarketplaceStore } from '@/store/marketplaceStore';
import { formatPrice } from '@/lib/utils';
import styles from './services.module.css';

const SERVICE_TYPES = [
  { label: 'All', value: 'all' },
  { label: 'Makeup Artists', value: 'Makeup Artist' },
  { label: 'Photographers', value: 'Photographer' },
  { label: 'Fashion Designers', value: 'Fashion Designer' },
  { label: 'Hair Stylists', value: 'Hair Stylist' },
];

export default function ServicesPage() {
  const allServices = useMarketplaceStore(s => s.services);
  const loading = !useMarketplaceStore(s => s.isInitialized);
  const [filter, setFilter] = useState('all');

  const filtered = allServices.filter((s) => !s.is_draft && (filter === 'all' || s.service_type === filter));

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
            <button 
              key={t.value} 
              className={`${styles.typePill} ${filter === t.value ? styles.typeActive : ''}`}
              onClick={() => setFilter(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Services Grid */}
        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-400)' }}>
            Loading campus services...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-400)' }}>
             No services found in this category.
          </div>
        ) : (
          <div className={styles.grid}>
            {filtered.map((svc) => {
              const brand = svc.brands;
              const waMessage = `Hi ${brand?.name ?? 'there'}! I found you on Master Cart and I'm interested in your service: *${svc.title}*. Please share more details.`;
              const normalizeNgPhone = (num: string) => {
                const digits = (num || '').replace(/\D/g, '');
                if (digits.startsWith('234')) return digits;
                if (digits.startsWith('0')) return '234' + digits.slice(1);
                if (digits.length === 10) return '234' + digits;
                return digits || '2348000000000';
              };
              const whatsapp = normalizeNgPhone(brand?.whatsapp_number ?? '');

              return (
                <div key={svc.id} className={styles.serviceCard}>
                  {/* Image */}
                  <div className={styles.imgWrap}>
                    <Image
                      src={svc.portfolio_urls?.[0] || 'https://images.unsplash.com/photo-1542272201-b1ca555f8505?w=500&auto=format&fit=crop&q=60'}
                      alt={svc.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 340px"
                      className={styles.img}
                    />
                    <div className={styles.imgGradient} />
                    <span className={`badge badge-gold ${styles.typeBadge}`}>
                      {svc.service_type}
                    </span>
                    {brand?.verified && (
                      <div className={styles.verifiedBadge}>
                        <CheckCircle size={13} className="verified-icon" />
                        <span>Verified</span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className={styles.cardBody}>
                    <div className={styles.brandRow}>
                      <span className={styles.brandName}>{brand?.name}</span>
                      {brand?.verified && <CheckCircle size={13} className="verified-icon" />}
                    </div>

                    <h3 className={styles.title}>{svc.title}</h3>
                    <p className={styles.description}>{svc.description}</p>

                    {/* Rating placeholder */}
                    <div className={styles.ratingRow}>
                      <div className="stars">
                        {[1,2,3,4,5].map((s) => (
                          <Star
                            key={s}
                            size={12}
                            fill={s <= 4 ? 'currentColor' : 'none'}
                            className={s <= 4 ? 'star-filled' : 'star-empty'}
                          />
                        ))}
                      </div>
                      <span className={styles.ratingNum}>4.8</span>
                    </div>

                    {/* Footer */}
                    <div className={styles.cardFooter}>
                      <div className={styles.pricing}>
                        <span className={styles.priceLabel}>Starting from</span>
                        <span className={styles.price}>{formatPrice(svc.price)}</span>
                      </div>
                      <a
                        href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(waMessage)}`}
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
        )}

        {/* CTA for Service Providers */}
        <div className={styles.providerCta}>
          <h2>Are you a Campus Creative?</h2>
          <p>List your makeup, photography, tailoring, or styling service on Master Cart for free.</p>
          <Link href="/onboarding" className="btn btn-primary btn-lg">
            List Your Service Free
          </Link>
        </div>
      </div>
    </main>
  );
}

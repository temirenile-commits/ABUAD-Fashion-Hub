import type { Metadata } from 'next';
import VendorCard from '@/components/VendorCard';
import { VENDORS } from '@/lib/data';
import { CheckCircle, Crown, TrendingUp } from 'lucide-react';
import styles from './vendors.module.css';

export const metadata: Metadata = {
  title: 'Campus Brands Directory',
  description: 'Discover and shop from verified fashion brands and vendors at ABUAD.',
};

export default function VendorsPage() {
  const verified = VENDORS.filter((v) => v.verified);
  const unverified = VENDORS.filter((v) => !v.verified);
  const topVendors = [...VENDORS].sort((a, b) => b.followers - a.followers).slice(0, 3);

  return (
    <main className="container">
      <div className={styles.page}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1>Campus Brand Directory</h1>
            <p className={styles.subtitle}>
              Discover {VENDORS.length} fashion brands on the ABUAD campus
            </p>
          </div>
          <div className={styles.headerStats}>
            <div className={styles.headerStat}>
              <CheckCircle size={18} className="verified-icon" />
              <span>{verified.length} Verified</span>
            </div>
            <div className={styles.headerStat}>
              <Crown size={18} style={{ color: 'var(--secondary)' }} />
              <span>Top Brands</span>
            </div>
          </div>
        </div>

        {/* Top 3 Leaderboard */}
        <section className={styles.leaderboard}>
          <div className={styles.leaderboardHead}>
            <TrendingUp size={18} style={{ color: 'var(--primary)' }} />
            <h2>Top Brands This Week</h2>
          </div>
          <div className={styles.leaderboardGrid}>
            {topVendors.map((vendor, i) => (
              <div
                key={vendor.id}
                className={`card ${styles.leaderCard} ${i === 0 ? styles.leaderFirst : ''}`}
              >
                <div className={styles.leaderRank}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                </div>
                <div className={styles.leaderLogo}>{vendor.logo}</div>
                <div className={styles.leaderInfo}>
                  <div className={styles.leaderName}>
                    {vendor.name}
                    {vendor.verified && <CheckCircle size={14} className="verified-icon" />}
                  </div>
                  <p className={styles.leaderCat}>{vendor.category}</p>
                </div>
                <div className={styles.leaderFollowers}>
                  <span className={styles.followerNum}>{vendor.followers}</span>
                  <span className={styles.followerLabel}>followers</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Verified Vendors */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionTitle}>
              <CheckCircle size={18} className="verified-icon" />
              <h2>Verified Brands</h2>
              <span className={`badge badge-success`}>{verified.length}</span>
            </div>
          </div>
          <div className={styles.grid}>
            {verified.map((vendor) => (
              <VendorCard key={vendor.id} vendor={vendor} />
            ))}
          </div>
        </section>

        {/* Unverified Vendors */}
        {unverified.length > 0 && (
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <div className={styles.sectionTitle}>
                <h2>New Brands</h2>
                <span className={`badge badge-gold`}>{unverified.length}</span>
              </div>
            </div>
            <div className={styles.grid}>
              {unverified.map((vendor) => (
                <VendorCard key={vendor.id} vendor={vendor} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

'use client';

import VendorCard, { LiveVendor } from '@/components/VendorCard';
import { useMarketplaceStore } from '@/store/marketplaceStore';
import { CheckCircle, Crown, TrendingUp } from 'lucide-react';
import styles from './vendors.module.css';

export default function VendorsPage() {
  const allBrands = useMarketplaceStore(s => s.vendors);
  const isInitialized = useMarketplaceStore(s => s.isInitialized);

  const LIVE_VENDORS = allBrands.map((brand) => {
    return {
      ...brand,
      verified: brand.verification_status === 'verified'
    };
  }) as any as LiveVendor[];

  const verified = LIVE_VENDORS.filter((v) => v.verified);
  const unverified = LIVE_VENDORS.filter((v) => !v.verified);
  const topVendors = [...LIVE_VENDORS].sort((a, b) => Number(b.followers_count || 0) - Number(a.followers_count || 0)).slice(0, 3);

  if (!isInitialized) {
    return <main className="container"><div style={{padding:'3rem',textAlign:'center'}}>Loading Live Vendors...</div></main>
  }

  return (
    <main className="container">
      <div className={styles.page}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1>Campus Brand Directory</h1>
            <p className={styles.subtitle}>
              Discover {LIVE_VENDORS.length} fashion brands on the Campus
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
        {topVendors.length > 0 && (
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
                  <div className={styles.leaderLogo}>
                    {vendor.logo_url && vendor.logo_url.startsWith('http') ? (
                       <img src={vendor.logo_url} alt="Logo" style={{width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%'}} />
                    ) : (
                      (vendor.name || 'AF').substring(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className={styles.leaderInfo}>
                    <div className={styles.leaderName}>
                      {vendor.name || 'Anonymous Brand'}
                      {vendor.verified && <CheckCircle size={14} className="verified-icon" />}
                    </div>
                    <p className={styles.leaderCat}>{vendor.category || 'Fashion'}</p>
                  </div>
                  <div className={styles.leaderFollowers}>
                    <span className={styles.followerNum}>{vendor.followers_count || 0}</span>
                    <span className={styles.followerLabel}>followers</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Verified Vendors */}
        {verified.length > 0 && (
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
        )}

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

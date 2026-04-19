import type { Metadata } from 'next';
import VendorCard, { LiveVendor } from '@/components/VendorCard';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { CheckCircle, Crown, TrendingUp } from 'lucide-react';
import styles from './vendors.module.css';

export const metadata: Metadata = {
  title: 'Campus Brands Directory',
  description: 'Discover and shop from verified fashion brands and vendors at ABUAD.',
};

export const revalidate = 60; // Revalidate every 60s

export default async function VendorsPage() {
  const { data: brands, error } = await supabaseAdmin
    .from('brands')
    .select(`
      *,
      products ( id )
    `);

  const LIVE_VENDORS = (brands || []).map((brand) => {
    const nameStr = brand.name || 'ABUAD';
    const num = nameStr.charCodeAt(0) * nameStr.charCodeAt(nameStr.length - 1) * 123;
    
    return {
      ...brand,
      followers: num % 5000, 
    };
  }) as any as LiveVendor[];

  const verified = LIVE_VENDORS.filter((v) => v.verified);
  const unverified = LIVE_VENDORS.filter((v) => !v.verified);
  const topVendors = [...LIVE_VENDORS].sort((a, b) => Number(b.followers) - Number(a.followers)).slice(0, 3);

  return (
    <main className="container">
      <div className={styles.page}>
        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1>Campus Brand Directory</h1>
            <p className={styles.subtitle}>
              Discover {LIVE_VENDORS.length} fashion brands on the ABUAD campus
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
                      vendor.name.substring(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className={styles.leaderInfo}>
                    <div className={styles.leaderName}>
                      {vendor.name}
                      {vendor.verified && <CheckCircle size={14} className="verified-icon" />}
                    </div>
                    <p className={styles.leaderCat}>{vendor.category || 'Fashion'}</p>
                  </div>
                  <div className={styles.leaderFollowers}>
                    <span className={styles.followerNum}>{vendor.followers}</span>
                    <span className={styles.followerLabel}>followers</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

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

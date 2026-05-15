'use client';

import { useMarketplaceStore } from '@/store/marketplaceStore';
import VividVideo from '@/components/VividVideo';
import styles from './reels.module.css';
import { ArrowLeft, Store } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';

export default function ReelsPage() {
  const allReels = useMarketplaceStore(s => s.reels).filter(r => !r.product_section || r.product_section === 'fashion');
  const allVendors = useMarketplaceStore(s => s.vendors);
  
  // Mixed feed logic: [Reel, Reel, VendorRow, Reel, Reel, VendorRow...]
  const mixedFeed: { type: 'reel' | 'vendors', data: any }[] = [];
  let reelIdx = 0;
  let vendorIdx = 0;
  
  if (allReels.length === 0 && allVendors.length === 0) {
    return (
      <div className={styles.reelsContainer} style={{ justifyContent: 'center', alignItems: 'center' }}>
        <p>Loading vivid content...</p>
      </div>
    );
  }

  while (reelIdx < allReels.length || (vendorIdx < allVendors.length && reelIdx > 0)) {
    if (reelIdx < allReels.length) {
      mixedFeed.push({ type: 'reel', data: allReels[reelIdx] });
      reelIdx++;
    }
    
    if (reelIdx > 0 && reelIdx % 2 === 0 && vendorIdx < allVendors.length) {
       mixedFeed.push({ type: 'vendors', data: allVendors.slice(vendorIdx, vendorIdx + 6) });
       vendorIdx += 6;
    }

    if (reelIdx >= allReels.length && vendorIdx >= allVendors.length) break;
  }

  return (
    <main className={styles.reelsContainer}>
       {/* Top Nav */}
       <div className={styles.topNav}>
         <Link href="/" className={styles.backBtn}><ArrowLeft size={24} /></Link>
         <h1 className="text-gradient">Vivid Fashion Reels</h1>
       </div>

       <div className={styles.feed}>
         {mixedFeed.map((item, i) => (
           <div key={i} className={styles.feedItem}>
             {item.type === 'reel' ? (
                <ReelItem reel={item.data} />
             ) : (
                <VendorRow vendors={item.data} />
             )}
           </div>
         ))}
         
         {mixedFeed.length === 0 && (
           <div style={{ padding: '4rem', textAlign: 'center' }}>
             <p>No reels yet. Check back soon for vivid campus fashion!</p>
             <Link href="/" className="btn btn-primary" style={{ marginTop: '1rem' }}>Back Home</Link>
           </div>
         )}
       </div>
    </main>
  );
}

function ReelItem({ reel }: { reel: any }) {
  const brandSlug = reel.brands?.name?.toLowerCase().replace(/\s+/g, '-') || 'brand';
  
  return (
    <div className={styles.reelWrapper}>
       <VividVideo 
         src={reel.video_url} 
         className={styles.video}
       />
       <div className={styles.overlay}>
         <div className={styles.meta}>
           <Link href={`/vendor/${brandSlug}?id=${reel.brand_id}`} className={styles.brandInfo}>
             {reel.brands?.logo_url ? (
               <img src={reel.brands.logo_url} alt="" className={styles.logo} />
             ) : (
               <div className={styles.logo} style={{ background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 {reel.brands?.name?.substring(0, 1)}
               </div>
             )}
             <span>{reel.brands?.name || 'Campus Brand'}</span>
           </Link>
           <h3>{reel.title || 'Exclusive Collection'}</h3>
         </div>
         <div className={styles.actions}>
            <Link href={`/vendor/${brandSlug}?id=${reel.brand_id}`} className={styles.actionBtn}>
              <Store size={20} />
              Visit
            </Link>
         </div>
       </div>
    </div>
  );
}

function VendorRow({ vendors }: { vendors: any[] }) {
  return (
    <div className={styles.vendorRowWrapper}>
      <div className={styles.rowHeader}>
        <h2>Stumble on Stores</h2>
        <Link href="/vendors" className={styles.allLink}>View All →</Link>
      </div>
      <div className={styles.scroller}>
        {vendors.map(v => {
          const slug = v.name?.toLowerCase().replace(/\s+/g, '-') || 'brand';
          return (
            <Link key={v.id} href={`/vendor/${slug}?id=${v.id}`} className={styles.miniVendorCard}>
              {v.logo_url ? (
                <img src={v.logo_url} alt="" />
              ) : (
                <div style={{ width: 100, height: 100, borderRadius: 20, background: 'var(--bg-300)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>
                  {v.name?.substring(0,1)}
                </div>
              )}
              <span>{v.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

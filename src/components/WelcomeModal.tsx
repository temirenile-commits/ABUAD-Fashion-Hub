'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, ShieldCheck, Sparkles, ShoppingBag, ArrowRight } from 'lucide-react';
import styles from './WelcomeModal.module.css';

export default function WelcomeModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const hasVisited = localStorage.getItem('afh_visited');
    if (!hasVisited) {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem('afh_visited', 'true');
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={handleClose} aria-label="Close">
          <X size={18} />
        </button>

        {/* Scrollable inner content */}
        <div className={styles.scrollArea}>
          <div className={styles.iconBox}>
            <Sparkles size={28} color="var(--primary)" />
          </div>
          
          <h2 className={styles.title}>Welcome to MasterCart</h2>
          <p className={styles.subtitle}>The #1 Digital Marketplace for Students & Entrepreneurs.</p>

          <div className={styles.featureList}>
            <div className={styles.featureItem}>
              <div className={styles.featureIcon}><ShieldCheck size={16} /></div>
              <div>
                <h4>Escrow Protected</h4>
                <p>Your money is safe. Vendors only get paid when you confirm delivery.</p>
              </div>
            </div>
            <div className={styles.featureItem}>
              <div className={styles.featureIcon}><ShoppingBag size={16} /></div>
              <div>
                <h4>Verified Campus Vendors</h4>
                <p>Shop from fellow students with 100% verification and trust.</p>
              </div>
            </div>
          </div>

          <div className={styles.policySummary}>
            <h4>Quick Terms:</h4>
            <ul>
              <li>✅ <strong>Escrow Protected</strong>: Payments held until delivery confirmed.</li>
              <li>✅ <strong>24h Release</strong>: Funds released to vendors after 24 hours.</li>
              <li>✅ <strong>Sponsored By</strong>: MIGHTY SEEDS EXCEL INVESTMENT LTD.</li>
            </ul>
            <p>By using the platform, you agree to our <Link href="/terms" onClick={handleClose}>Full Terms of Service</Link>.</p>
          </div>

          <div className={styles.actions}>
            <Link href="/auth/register" onClick={handleClose} className={styles.primaryBtn}>
              Create Account <ArrowRight size={15} />
            </Link>
            <button onClick={handleClose} className={styles.secondaryBtn}>
              Just Browsing
            </button>
          </div>
          
          <p className={styles.sponsor}>Sponsored & Under MIGHTY SEEDS EXCEL INVESTMENT LTD.</p>
        </div>
      </div>
    </div>
  );
}

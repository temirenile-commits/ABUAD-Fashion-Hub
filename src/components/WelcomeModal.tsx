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
      }, 1500); // Show after 1.5 seconds
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem('afh_visited', 'true');
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <button className={styles.closeBtn} onClick={handleClose}>
          <X size={20} />
        </button>

        <div className={styles.content}>
          <div className={styles.iconBox}>
            <Sparkles size={32} color="var(--primary)" />
          </div>
          
          <h2 className={styles.title}>Welcome to ABUAD Fashion Hub</h2>
          <p className={styles.subtitle}>The #1 Digital Marketplace for ABUAD Students & Entrepreneurs.</p>

          <div className={styles.featureList}>
            <div className={styles.featureItem}>
              <div className={styles.featureIcon}><ShieldCheck size={18} /></div>
              <div>
                <h4>Escrow Protected Payments</h4>
                <p>Your money is safe. Vendors only get paid when you confirm delivery.</p>
              </div>
            </div>
            <div className={styles.featureItem}>
              <div className={styles.featureIcon}><ShoppingBag size={18} /></div>
              <div>
                <h4>Verified Campus Vendors</h4>
                <p>Shop from your fellow students with 100% verification and trust.</p>
              </div>
            </div>
          </div>

          <div className={styles.policyBox}>
            <p>By using the platform, you agree to our <Link href="/terms" onClick={handleClose}>Terms of Service</Link> and Statement of Operations.</p>
          </div>

          <div className={styles.actions}>
            <Link href="/auth/register" onClick={handleClose} className={styles.primaryBtn}>
              Create Account <ArrowRight size={16} />
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

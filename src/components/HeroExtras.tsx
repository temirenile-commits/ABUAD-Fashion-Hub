'use client';
import Link from 'next/link';
import { HelpCircle, Store, Zap, Truck } from 'lucide-react';
import styles from './HeroExtras.module.css';

export default function HeroExtras() {
  return (
    <div className={styles.container}>
      <Link href="https://wa.me/2347045592604" target="_blank" className={styles.card}>
        <div className={styles.iconBox}>
          <HelpCircle size={20} className={styles.iconGold} />
        </div>
        <div className={styles.text}>
          <h4>Help Center</h4>
          <p>Guide to shopping</p>
        </div>
      </Link>

      <div className={styles.card}>
        <div className={styles.iconBox}>
          <Store size={20} className={styles.iconGold} />
        </div>
        <div className={styles.text}>
          <h4>Sell on Hub</h4>
          <p>Open your store</p>
        </div>
      </div>

      <div className={styles.banner}>
        <div className={styles.badge}>
          <Truck size={14} />
          <span>Express</span>
        </div>
        <h3>Free Delivery</h3>
        <p>Across ABUAD Campus</p>
      </div>

      <div className={styles.promo}>
        <Zap size={24} className={styles.pulse} />
        <span>Join Fashion Week</span>
      </div>
    </div>
  );
}

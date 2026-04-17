'use client';
import Link from 'next/link';
import { CheckCircle, Package, ArrowRight, ShoppingBag, ShieldCheck } from 'lucide-react';
import styles from './success.module.css';

export default function CheckoutSuccessPage() {
  return (
    <div className={`container ${styles.page}`}>
      <div className={`${styles.card} anim-fade-up`}>
        <div className={styles.iconWrap}>
          <CheckCircle size={64} className={styles.checkIcon} />
        </div>
        
        <h1 className={styles.title}>Payment Successful!</h1>
        <p className={styles.subtitle}>
          Your order has been placed successfully and your funds are now secured in Escrow.
        </p>

        <div className={styles.escrowFlow}>
          <div className={styles.flowItem}>
            <ShieldCheck size={20} className={styles.flowIcon} />
            <div>
              <h3>Escrow Protection Active</h3>
              <p>The vendor will only receive payment after you confirm receipt of your item.</p>
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <Link href="/dashboard/customer" className="btn btn-primary btn-lg">
            <Package size={18} /> Track Your Order
          </Link>
          <Link href="/explore" className="btn btn-ghost">
            <ShoppingBag size={18} /> Continue Shopping
          </Link>
        </div>

        <div className={styles.support}>
          <p>Need help with your order? <Link href="/support">Contact Support</Link></p>
        </div>
      </div>
    </div>
  );
}

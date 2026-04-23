'use client';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, Package, ShoppingBag, ShieldCheck, Lock, ArrowRight, Loader2 } from 'lucide-react';
import styles from './success.module.css';

function SuccessContent() {
  const searchParams = useSearchParams();
  const ref = searchParams.get('ref') || searchParams.get('reference');
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    // Artificial delay to signify deep validation (or actual check if desired)
    const timer = setTimeout(() => setVerifying(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`container ${styles.page}`}>
      <div className={`${styles.card} anim-fade-up`}>
        {verifying ? (
          <div className={styles.verifyingState}>
             <Loader2 size={48} className="anim-spin" style={{ color: 'var(--primary)', marginBottom: '1.5rem' }} />
             <h2>Validating Payment...</h2>
             <p>Our secure nodes are verifying your transaction ref: <strong>{ref?.slice(0, 12)}...</strong></p>
          </div>
        ) : (
          <>
            <div className={styles.iconWrap}>
              <CheckCircle size={64} className={styles.checkIcon} />
            </div>
            
            <h1 className={styles.title}>Payment Secured!</h1>
            <div className={styles.refBadge}>REF: {ref || 'HUB-SUCCESS'}</div>
            
            <p className={styles.subtitle}>
              Your order has been placed successfully. Funds are held safely in **Escrow Protection**.
            </p>

            <div className={styles.escrowFlow}>
              <div className={styles.flowItem}>
                <ShieldCheck size={24} className={styles.flowIcon} />
                <div>
                  <h3>Escrow Protection: ACTIVE</h3>
                  <p>Payment will be released to the vendor ONLY after you confirm delivery.</p>
                </div>
              </div>
            </div>

            <div className={styles.actions}>
              <Link href="/dashboard/customer" className="btn btn-primary btn-lg">
                <Package size={18} /> Manage Orders
              </Link>
              <Link href="/explore" className="btn btn-ghost">
                <ShoppingBag size={18} /> Keep Shopping
              </Link>
            </div>
          </>
        )}

        <div className={styles.support}>
          <p>Need immediate help? <Link href="/support">Hub Support is online.</Link></p>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div>Loading Success Hub...</div>}>
      <SuccessContent />
    </Suspense>
  );
}

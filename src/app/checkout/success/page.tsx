'use client';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, Package, ShoppingBag, ShieldCheck, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from './success.module.css';

function SuccessContent() {
  const searchParams = useSearchParams();
  const ref = searchParams.get('ref') || searchParams.get('reference');
  const [status, setStatus] = useState<'verifying' | 'success' | 'failed'>('verifying');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!ref) {
      setStatus('failed');
      return;
    }

    const checkPayment = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('status')
          .eq('paystack_reference', ref);

        if (error) throw error;

        // If any order in the batch is marked as 'paid', it's a success
        const isPaid = data?.some(o => o.status === 'paid');
        
        if (isPaid) {
          setStatus('success');
        } else if (retryCount < 5) {
          // Webhook might be slightly delayed, retry in 3 seconds
          setTimeout(() => setRetryCount(c => c + 1), 3000);
        } else {
          // If still pending after 5 retries (~15 seconds)
          setStatus('failed');
        }
      } catch (err) {
        console.error('Error checking payment:', err);
        if (retryCount < 3) setTimeout(() => setRetryCount(c => c + 1), 3000);
        else setStatus('failed');
      }
    };

    checkPayment();
  }, [ref, retryCount]);

  if (status === 'verifying') {
    return (
      <div className={`container ${styles.page}`}>
        <div className={`${styles.card} anim-fade-up`}>
          <div className={styles.verifyingState}>
             <Loader2 size={48} className="anim-spin" style={{ color: 'var(--primary)', marginBottom: '1.5rem' }} />
             <h2>Validating Payment...</h2>
             <p>Our secure nodes are verifying your transaction ref: <strong>{ref?.slice(0, 12)}...</strong></p>
             <p style={{ fontSize: '0.85rem', color: 'var(--text-400)', marginTop: '1rem' }}>Retry {retryCount}/5</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className={`container ${styles.page}`}>
        <div className={`${styles.card} anim-fade-up`}>
          <div className={styles.iconWrap} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
            <Lock size={64} />
          </div>
          <h1 className={styles.title} style={{ color: '#ef4444' }}>Payment Incomplete</h1>
          <p className={styles.subtitle}>
            It seems you didn't pay the bill or the transaction was canceled. If you have been debited, please wait a moment and refresh.
          </p>
          <div className={styles.actions}>
            <Link href="/cart" className="btn btn-primary btn-lg">
              <ShoppingBag size={18} /> Back to Cart
            </Link>
            <Link href="/support" className="btn btn-ghost">
              Contact Support
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`container ${styles.page}`}>
      <div className={`${styles.card} anim-fade-up`}>
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

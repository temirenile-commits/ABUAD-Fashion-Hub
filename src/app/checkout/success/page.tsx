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
  const [status, setStatus] = useState<'verifying' | 'success' | 'failed' | 'manual_pending'>('verifying');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const initStatus = async () => {
      if (!ref) {
        setStatus('failed');
        return;
      }
      if (ref.startsWith('MANUAL-') || searchParams.get('system') === 'manual') {
        setStatus('manual_pending');
        return;
      }
    };
    initStatus();

    const checkPayment = async () => {
      if (ref?.startsWith('MANUAL-') || searchParams.get('system') === 'manual') {
        return;
      }
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('status')
          .eq('paystack_reference', ref);

        if (error) throw error;

        // If any order in the batch is marked as 'paid' or 'preorder_paid', it's a success
        const isPaid = data?.some(o => o.status === 'paid' || o.status === 'preorder_paid');
        
        if (isPaid) {
          setStatus('success');
        } else if (retryCount < 8) {
          // Webhook might be slightly delayed, retry in 3 seconds. Increased retries to 8 (~24s) for slower network conditions.
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

  if (status === 'manual_pending') {
    return (
      <div className={`container ${styles.page}`}>
        <div className={`${styles.card} anim-fade-up`}>
          <div className={styles.iconWrap} style={{ background: '#1F1F23', color: '#FFFFFF' }}>
            <CheckCircle size={64} style={{ color: '#FFFFFF' }} />
          </div>
          
          <h1 className={styles.title} style={{ color: '#FFFFFF' }}>Transfer Details Received!</h1>
          <div className={styles.refBadge} style={{ background: '#1F1F23', color: '#FFFFFF' }}>REF: {ref || 'MANUAL-PENDING'}</div>
          
          <p className={styles.subtitle}>
            Your payment receipt has been submitted to the Super Admin for manual verification. 
            Orders remain pending and will be sent to the vendor immediately once approved.
          </p>

          <div className={styles.escrowFlow} style={{ borderLeftColor: '#FFFFFF', marginBottom: '2rem' }}>
            <div className={styles.flowItem}>
              <ShieldCheck size={24} style={{ color: '#FFFFFF' }} className={styles.flowIcon} />
              <div>
                <h3 style={{ color: '#FFFFFF' }}>Platform Verification: PENDING</h3>
                <p>The admin matches the transaction reference to verify GTB receipt. This typically takes 5–15 minutes.</p>
              </div>
            </div>
          </div>

          <div className={styles.actions}>
            <Link href="/dashboard/customer" className="btn btn-primary btn-lg" style={{ background: 'linear-gradient(135deg, #FFFFFF 0%, #FFFFFF 100%)', borderColor: '#27272A' }}>
              <Package size={18} /> View My Dashboard
            </Link>
            <Link href="/explore" className="btn btn-ghost">
              <ShoppingBag size={18} /> Keep Shopping
            </Link>
          </div>

          <div className={styles.support}>
            <p>Made a mistake? <Link href="/support">Contact Support to update details.</Link></p>
          </div>
        </div>
      </div>
    );
  }

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
          <div className={styles.iconWrap} style={{ background: '#18181B', color: '#FFFFFF' }}>
            <Lock size={64} />
          </div>
          <h1 className={styles.title} style={{ color: '#000000' }}>Payment Status Pending</h1>
          <p className={styles.subtitle}>
            We haven&apos;t received confirmation from your bank yet. If you have been debited, please tap the button below to force a manual sync.
          </p>
          <div className={styles.actions} style={{ flexDirection: 'column', gap: '1rem' }}>
            <button 
              className="btn btn-primary btn-lg w-full"
              onClick={async (e) => {
                const btn = e.currentTarget;
                btn.disabled = true;
                btn.innerHTML = 'Verifying with Paystack...';
                try {
                  const res = await fetch('/api/checkout/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reference: ref })
                  });
                  const data = await res.json();
                  if (data.success) {
                    setStatus('success');
                  } else {
                    alert(data.error || 'Verification failed. Please contact support.');
                    btn.disabled = false;
                    btn.innerHTML = 'Try Manual Verification Again';
                  }
                } catch (err) {
                  alert('Network error during verification.');
                  btn.disabled = false;
                  btn.innerHTML = 'Try Manual Verification Again';
                }
              }}
            >
              Verify My Payment Now
            </button>
            <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
              <Link href="/dashboard/customer" className="btn btn-ghost w-full">
                My Dashboard
              </Link>
              <Link href="/support" className="btn btn-ghost w-full">
                Get Help
              </Link>
            </div>
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

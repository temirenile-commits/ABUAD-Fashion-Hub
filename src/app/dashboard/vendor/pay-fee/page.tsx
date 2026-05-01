'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, CheckCircle, ShieldCheck, Loader2, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from '../dashboard.module.css';
import Link from 'next/link';

export default function PayFeePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [brand, setBrand] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    async function checkStatus() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/login?redirect=/dashboard/vendor');
        return;
      }
      
      // The fee system is removed. Redirecting everyone to dashboard.
      router.replace('/dashboard/vendor');

      const { data: brandData } = await supabase
        .from('brands')
        .select('*')
        .eq('owner_id', session.user.id)
        .single();

      if (!brandData) {
        router.push('/onboarding');
        return;
      }

      if (brandData.fee_paid) {
        router.push('/dashboard/vendor');
        return;
      }

      if (brandData.verification_status !== 'approved') {
        router.push('/dashboard/vendor');
        return;
      }

      setBrand(brandData);
      setLoading(false);
    }
    checkStatus();
  }, [router]);

  const handlePayment = async () => {
    setPaying(true);
    try {
      const res = await fetch('/api/vendor/activation-fee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      const data = await res.json();
      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        alert(data.error || 'Payment initialization failed');
      }
    } catch (err) {
      console.error(err);
      alert('Network error initializing payment');
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <Loader2 className="anim-spin" size={32} />
      </div>
    );
  }

  return (
    <div className={`container ${styles.page}`}>
      <div style={{ maxWidth: '600px', margin: '4rem auto' }}>
        <Link href="/" className="btn btn-ghost mb-4">
          <ArrowLeft size={16} /> Back to Hub
        </Link>
        
        <div className="card" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ width: '80px', height: '80px', background: 'rgba(201, 161, 74, 0.1)', color: 'var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
              <ShieldCheck size={40} />
            </div>
            <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Account Approved!</h1>
            <p style={{ color: 'var(--text-300)' }}>Your brand <strong>{brand.name}</strong> has been verified. To activate your store and start selling, a one-time activation fee is required.</p>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '1.5rem', marginBottom: '2rem', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <span>Activation Fee</span>
              <span style={{ fontWeight: 600 }}>₦2,000.00</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)', fontSize: '0.9rem' }}>
              <span>Status</span>
              <span>Approved (âœ…)</span>
            </div>
          </div>

          <button 
            className="btn btn-primary w-full" 
            style={{ padding: '1rem', fontSize: '1.1rem' }} 
            onClick={handlePayment}
            disabled={paying}
          >
            {paying ? (
              <>
                <Loader2 className="anim-spin" size={20} style={{ marginRight: '0.5rem' }} /> 
                Initializing Paystack...
              </>
            ) : (
              <>
                <CreditCard size={20} style={{ marginRight: '0.5rem' }} /> 
                Pay ₦2,000 & Go Live
              </>
            )}
          </button>

          <p style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--text-400)' }}>
            Securely processed by Paystack. Your store will be unlocked immediately after payment.
          </p>
        </div>
      </div>
    </div>
  );
}


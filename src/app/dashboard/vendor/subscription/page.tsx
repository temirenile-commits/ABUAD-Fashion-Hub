'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Zap, 
  CheckCircle2, 
  ShieldCheck, 
  ArrowLeft, 
  Rocket, 
  Target, 
  Crown,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import styles from '../dashboard.module.css';

const TIERS = [
  {
    id: 'quarter',
    name: 'Quarter Power',
    price: 5000,
    icon: <Target size={32} color="#3b82f6" />,
    features: [
      '10 Marketplace Products',
      '1 Collection Reel',
      'Basic Sales Analytics',
      'WhatsApp Customer Leads',
      'Standard Support'
    ],
    color: '#3b82f6',
    popular: false
  },
  {
    id: 'half',
    name: 'Half Power',
    price: 10000,
    icon: <Rocket size={32} color="var(--primary)" />,
    features: [
      '50 Marketplace Products',
      '5 Collection Reels',
      'Advanced Growth Analytics',
      'Promo Codes & Discounts',
      'Priority Customer Support'
    ],
    color: 'var(--primary)',
    popular: true
  },
  {
    id: 'full',
    name: 'Full Power',
    price: 20000,
    icon: <Crown size={32} color="#f59e0b" />,
    features: [
      'Unlimited Products',
      'Unlimited Collection Reels',
      'Premium Business Intelligence',
      'Custom Store Banner',
      'Featured Shop Placement',
      'Dedicated Account Manager'
    ],
    color: '#f59e0b',
    popular: false
  }
];

export default function SubscriptionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState('');
  const [brand, setBrand] = useState<any>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    async function checkStatus() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/login?redirect=/dashboard/vendor/subscription');
        return;
      }
      setUser(session.user);

      const { data: brandData } = await supabase
        .from('brands')
        .select('*')
        .eq('owner_id', session.user.id)
        .single();

      if (!brandData) {
        router.push('/onboarding');
        return;
      }

      setBrand(brandData);
      setLoading(false);
    }
    checkStatus();
  }, [router]);

  const handleSubscribe = async (tier: any) => {
    setPaying(tier.id);
    try {
      // Integration with subscription API
      const res = await fetch('/api/vendor/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.id,
          brandId: brand.id,
          tierId: tier.id,
          amount: tier.price
        }),
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
      setPaying('');
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
      <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
        <Link href="/dashboard/vendor" className="btn btn-ghost mb-4">
          <ArrowLeft size={16} /> Dashboard
        </Link>
        
        <header style={{ textAlign: 'center', marginBottom: '4rem' }}>
          <h1 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: '1rem' }}>Choose Your Power Level</h1>
          <p style={{ fontSize: '1.2rem', color: 'var(--text-300)', maxWidth: '600px', margin: '0 auto' }}>
            Scale your brand's reach and unleash advanced selling capabilities.
          </p>
        </header>

        <div className={styles.pricingGrid}>
          {TIERS.map((tier) => (
            <div 
              key={tier.id} 
              className={`${styles.pricingCard} ${tier.popular ? styles.popularCard : ''}`}
            >
              {tier.popular && <div className={styles.popularBadge}>Most Popular</div>}
              <div className={styles.cardHeader}>
                <div style={{ marginBottom: '1.5rem' }}>{tier.icon}</div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{tier.name}</h3>
                <div className={styles.priceContainer}>
                  <span className={styles.currency}>₦</span>
                  <span className={styles.amount}>{tier.price.toLocaleString()}</span>
                  <span className={styles.period}>/mo</span>
                </div>
              </div>

              <ul className={styles.featureList}>
                {tier.features.map((feature, i) => (
                  <li key={i}>
                    <CheckCircle2 size={18} color={tier.color} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button 
                className={`btn ${tier.popular ? 'btn-primary' : 'btn-ghost'}`}
                style={{ width: '100%', marginTop: 'auto', padding: '1.25rem' }}
                onClick={() => handleSubscribe(tier)}
                disabled={!!paying}
              >
                {paying === tier.id ? <Loader2 className="anim-spin" size={18} /> : `Activate ${tier.name}`}
              </button>
            </div>
          ))}
        </div>

        <footer style={{ marginTop: '5rem', textAlign: 'center', padding: '3rem', background: 'var(--bg-200)', borderRadius: '24px' }}>
          <ShieldCheck size={32} color="var(--success)" style={{ marginBottom: '1rem' }} />
          <h3>Secure & Instant Activation</h3>
          <p style={{ color: 'var(--text-400)', maxWidth: '500px', margin: '0.5rem auto' }}>
            Payments are processed securely via Paystack. Your brand powers will be unlocked immediately after a successful transaction.
          </p>
        </footer>
      </div>

      <style jsx>{`
        .pricingGrid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 2rem;
          margin-bottom: 2rem;
        }
        .pricingCard {
          background: var(--bg-100);
          border: 1px solid var(--border);
          border-radius: 24px;
          padding: 2.5rem;
          display: flex;
          flex-direction: column;
          position: relative;
          transition: all 0.3s var(--ease-out);
        }
        .pricingCard:hover {
          transform: translateY(-8px);
          border-color: var(--primary);
          box-shadow: 0 20px 40px rgba(0,0,0,0.2);
        }
        .popularCard {
          border-color: var(--primary);
          background: linear-gradient(to bottom, var(--bg-100), var(--bg-200));
          transform: scale(1.05);
        }
        .popularCard:hover {
          transform: translateY(-8px) scale(1.05);
        }
        .popularBadge {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          background: var(--primary);
          color: #fff;
          padding: 0.4rem 1.2rem;
          border-radius: var(--radius-full);
          font-size: 0.8rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .priceContainer {
          margin: 1.5rem 0;
          display: flex;
          align-items: baseline;
        }
        .currency {
          font-size: 1.5rem;
          font-weight: 700;
          opacity: 0.7;
        }
        .amount {
          font-size: 3rem;
          font-weight: 800;
          letter-spacing: -0.02em;
        }
        .period {
          font-size: 1rem;
          color: var(--text-400);
          margin-left: 0.25rem;
        }
        .featureList {
          list-style: none;
          padding: 0;
          margin: 2rem 0;
          flex: 1;
        }
        .featureList li {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          margin-bottom: 1rem;
          font-size: 0.95rem;
          color: var(--text-200);
        }
      `}</style>
    </div>
  );
}

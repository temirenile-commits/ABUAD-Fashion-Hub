'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Scale, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function TermsPage() {
  const [policy, setPolicy] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPolicy() {
      const { data } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'platform_policy')
        .single();
      
      if (data?.value) {
        setPolicy(typeof data.value === 'string' ? JSON.parse(data.value) : data.value);
      }
      setLoading(false);
    }
    fetchPolicy();
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-100)' }}>
        <Loader2 className="anim-spin" size={32} color="var(--primary)" />
      </div>
    );
  }

  return (
    <main style={{ background: 'var(--bg-100)', minHeight: '100vh' }}>
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, var(--bg-200) 0%, var(--bg-300) 100%)',
        borderBottom: '1px solid var(--border)',
        padding: '4rem 1.5rem 3rem',
        textAlign: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <Scale size={32} color="var(--primary)" />
          <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 900, margin: 0 }}>
            Terms & Conditions
          </h1>
        </div>
        <p style={{ color: 'var(--text-300)', maxWidth: '600px', margin: '0 auto 1.5rem', lineHeight: 1.7 }}>
          Welcome to ABUAD Fashion Hub. By accessing or using this platform, you agree to these terms. These policies are updated in real-time to reflect platform operations.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <span style={{ background: 'var(--bg-300)', border: '1px solid var(--border)', borderRadius: '999px', padding: '0.3rem 1rem', fontSize: '0.8rem', color: 'var(--text-400)' }}>
            Last Updated: {policy?.last_updated || 'April 2026'}
          </span>
          <span style={{ background: 'var(--bg-300)', border: '1px solid var(--accent-gold)', borderRadius: '999px', padding: '0.3rem 1rem', fontSize: '0.8rem', color: 'var(--accent-gold)' }}>
            Official ABUAD Fashion Hub Policy
          </span>
        </div>
      </div>

      <div className="container" style={{ maxWidth: '860px', padding: '3rem 1.5rem 6rem' }}>
        {policy?.sections?.map((section: any, idx: number) => (
          <div key={idx} style={{ marginBottom: '3rem' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '1.25rem', color: 'var(--text-100)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
               <div style={{ width: '8px', height: '24px', background: 'var(--primary)', borderRadius: '4px' }} />
               {section.title}
            </h2>
            <div style={{ color: 'var(--text-200)', lineHeight: 1.8, fontSize: '1.05rem' }}>
               {section.content.split('\n').map((line: string, lidx: number) => (
                 <p key={lidx} style={{ marginBottom: '1rem' }}>{line}</p>
               ))}
            </div>
          </div>
        ))}

        {!policy && (
            <div style={{ textAlign: 'center', padding: '4rem 0' }}>
                 <p style={{ color: 'var(--text-400)' }}>No policy sections found. Please check back later.</p>
                 <Link href="/" className="btn btn-primary mt-4">Back to Marketplace</Link>
            </div>
        )}

        {/* Sponsor Footer */}
        <div style={{
          marginTop: '3rem',
          padding: '2rem',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(212,175,55,0.1), rgba(212,175,55,0.05))',
          border: '1px solid rgba(212,175,55,0.3)',
          textAlign: 'center',
        }}>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-400)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Sponsored & Proudly Under</p>
          <h3 style={{ margin: '0.5rem 0 0', color: 'var(--accent-gold)', fontWeight: 900, fontSize: '1.1rem', letterSpacing: '0.05em' }}>
            MIGHTY SEEDS EXCEL INVESTMENT LTD.
          </h3>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', color: 'var(--text-400)' }}>Empowering campus commerce since inception.</p>
        </div>

        <div style={{ textAlign: 'center', marginTop: '3rem' }}>
          <Link href="/" className="btn btn-ghost btn-sm">← Back to Marketplace</Link>
        </div>
      </div>
    </main>
  );
}

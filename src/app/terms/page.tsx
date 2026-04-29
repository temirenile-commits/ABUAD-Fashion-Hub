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

  const defaultPolicy = {
    last_updated: 'April 2026',
    sections: [
      {
        title: '1. Platform Identity & Mission',
        content: 'ABUAD Fashion Hub (AFH) is a digital marketplace designed exclusively for Afe Babalola University student entrepreneurs. Our mission is to provide a "Vivid" commercial experience that empowers students to build brands while maintaining academic integrity. All operations are sponsored and governed by MIGHTY SEEDS EXCEL INVESTMENT LTD.'
      },
      {
        title: '2. User Eligibility & Verification',
        content: 'Access to AFH is restricted to verified students, alumni, and staff of Afe Babalola University. Registration requires a valid university email or matriculation details. We reserve the right to suspend any account that cannot provide proof of campus affiliation upon request.'
      },
      {
        title: '3. The Escrow Payment System',
        content: 'To protect both buyers and sellers, AFH utilizes a mandatory Escrow system. When a customer pays for an item, the funds are securely held by the platform. Funds are ONLY released to the vendor wallet 24 hours after the customer confirms receipt of the goods via the unique delivery code system. This 24-hour window allows for dispute filing in case of "item not as described".'
      },
      {
        title: '4. Vendor Listing Credits & Tiers',
        content: 'The platform operates on a Listing Credit model. 1 Credit equals 1 Active Product Listing. Vendors can subscribe to different "Power Tiers" (Quarter, Half, Full Power) to unlock more credits, real-time analytics, and promotion tools. Credits never expire as long as the subscription remains active.'
      },
      {
        title: '5. The 48-Hour Vendor Demotion Policy',
        content: 'In line with our commitment to quality, new vendors MUST complete their brand profile (Upload Logo, Cover, Location, and WhatsApp details) within 48 hours of registration. Failure to do so will result in an automatic "Store Suspension" where listings become invisible to the public until the profile is finalized.'
      },
      {
        title: '6. Logistics & Delivery Agent Protocol',
        content: 'Deliveries within the ABUAD campus are handled by verified Student Delivery Agents. Each order generates a unique 6-digit Delivery Code. Customers must ONLY provide this code to the agent once they have physically inspected and received their item. Handing over the code is the legal confirmation of delivery.'
      },
      {
        title: '7. Prohibited Items & Conduct',
        content: 'The sale of illegal substances, weapons, offensive materials, or items that violate the ABUAD University Handbook is strictly prohibited. Vendors found selling counterfeit or stolen goods will be permanently banned from the platform and reported to the Dean of Student Affairs.'
      },
      {
        title: '8. Withdrawals & Payouts',
        content: 'Vendors can request a withdrawal from their wallet once funds are cleared from Escrow. Payouts are processed via Paystack to any Nigerian bank account. A standard platform commission (currently 10%) is deducted from each sale to cover operational costs, payment processing, and server maintenance.'
      },
      {
        title: '9. Marketing & Promotions',
        content: 'Vendors may use "Billboard Boosts" or "Flash Sales" to increase visibility. These are premium features that place your brand in the homepage spotlight. Content for these promotions must be high-fidelity and professional (Vivid) to maintain the platform aesthetics.'
      },
      {
        title: '10. Disputes & Resolutions',
        content: 'In the event of a dispute, the AFH Admin team acts as the final arbitrator. We will review chat logs, order history, and delivery timestamps. Decisions made by the Admin team regarding refunds or fund releases are final.'
      }
    ]
  };

  const activePolicy = policy || defaultPolicy;

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
            Last Updated: {activePolicy.last_updated}
          </span>
          <span style={{ background: 'var(--bg-300)', border: '1px solid var(--accent-gold)', borderRadius: '999px', padding: '0.3rem 1rem', fontSize: '0.8rem', color: 'var(--accent-gold)' }}>
            Official ABUAD Fashion Hub Policy
          </span>
        </div>
      </div>

      <div className="container" style={{ maxWidth: '860px', padding: '3rem 1.5rem 6rem' }}>
        {activePolicy.sections.map((section: any, idx: number) => (
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

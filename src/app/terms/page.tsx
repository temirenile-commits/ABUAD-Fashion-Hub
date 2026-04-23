import Link from 'next/link';
import { ShieldCheck, Users, Store, AlertTriangle, CheckCircle, Scale } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms & Conditions | ABUAD Fashion Hub',
  description: 'Terms of Service, Statement of Operation, and User Agreement for customers and vendors on ABUAD Fashion Hub.',
};

export default function TermsPage() {
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
            Terms &amp; Conditions
          </h1>
        </div>
        <p style={{ color: 'var(--text-300)', maxWidth: '600px', margin: '0 auto 1.5rem', lineHeight: 1.7 }}>
          Welcome to ABUAD Fashion Hub. By accessing or using this platform, you agree to these terms. Please read carefully.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <span style={{ background: 'var(--bg-300)', border: '1px solid var(--border)', borderRadius: '999px', padding: '0.3rem 1rem', fontSize: '0.8rem', color: 'var(--text-400)' }}>
            Last Updated: April 2026
          </span>
          <span style={{ background: 'var(--bg-300)', border: '1px solid var(--accent-gold)', borderRadius: '999px', padding: '0.3rem 1rem', fontSize: '0.8rem', color: 'var(--accent-gold)' }}>
            Sponsored &amp; Under MIGHTY SEEDS EXCEL INVESTMENT LTD.
          </span>
        </div>
      </div>

      <div className="container" style={{ maxWidth: '860px', padding: '3rem 1.5rem 6rem' }}>

        {/* Section Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '2.5rem 0 2rem' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontWeight: 700, fontSize: '1rem' }}>
            <Users size={18} /> Customer Terms
          </div>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        </div>

        <Section title="1. Platform Overview">
          <p>ABUAD Fashion Hub (AFH) is a campus-based digital marketplace connecting students and staff of Afe Babalola University (ABUAD) with verified student vendors. We facilitate product discovery, secure payments, and order fulfilment within the university ecosystem.</p>
          <p>The platform is operated by ABUAD FASHIONISTA and is sponsored and under the umbrella of <strong>MIGHTY SEEDS EXCEL INVESTMENT LTD.</strong></p>
        </Section>

        <Section title="2. Eligibility">
          <p>By creating an account, you confirm that you are:</p>
          <ul>
            <li>At least 16 years of age.</li>
            <li>A student, staff member, or affiliate of ABUAD or its community.</li>
            <li>Providing accurate and truthful registration information.</li>
          </ul>
        </Section>

        <Section title="3. Customer Purchases & Escrow Protection">
          <ul>
            <li>All purchases on AFH are protected by our <strong>Escrow System</strong>. Funds are held securely and are NOT released to vendors until you confirm delivery of your order.</li>
            <li>Payment processing is handled by <strong>Paystack</strong>, a PCI-DSS compliant payment gateway. AFH does not store your card details.</li>
            <li>After placing an order, you will receive a confirmation notification. The vendor is obligated to fulfil your order within their stated shipping policy.</li>
            <li>If an order is not delivered or significantly differs from the listing, contact our support team before confirming delivery. <strong>Confirming delivery releases escrow and is final.</strong></li>
            <li>Delivery fees (₦1,500 for platform delivery) are charged at checkout and are non-refundable once a rider is dispatched.</li>
          </ul>
        </Section>

        <Section title="4. Refund & Dispute Policy (Customers)">
          <ul>
            <li>Customers may raise a dispute <strong>before confirming delivery</strong>. Disputes must be raised within 48 hours of the order being marked as &quot;Delivered&quot;.</li>
            <li>Refunds, if approved, will be credited to your wallet or original payment method within 3–5 business days.</li>
            <li>AFH reserves the right to make the final decision on all disputes based on available evidence.</li>
            <li>Items that are used, damaged by the customer, or missing original packaging are not eligible for refunds unless the damage was pre-existing.</li>
          </ul>
        </Section>

        <Section title="5. Prohibited Customer Behaviour">
          <ul>
            <li>Fraudulent chargebacks or false dispute claims.</li>
            <li>Harassing or threatening vendors through the platform messaging system.</li>
            <li>Using the platform for any purpose other than lawful commerce.</li>
            <li>Sharing account credentials with any third party.</li>
          </ul>
          <p>Violation of these rules may result in immediate account suspension and legal action.</p>
        </Section>

        <Section title="6. Customer Data & Privacy">
          <p>We collect your name, email, phone number, and delivery address solely to facilitate your orders. Your information is never sold to third parties. For full details, refer to our Privacy Policy.</p>
        </Section>

        {/* Vendor Section Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '3rem 0 2rem' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', fontWeight: 700, fontSize: '1rem' }}>
            <Store size={18} /> Vendor Terms
          </div>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        </div>

        <Section title="7. Vendor Account & Activation">
          <ul>
            <li>To sell on AFH, vendors must complete the onboarding process, including providing a valid student or staff ID, WhatsApp contact, and paying the one-time <strong>Vendor Activation Fee</strong> as determined by the platform.</li>
            <li>Activation is subject to admin approval. AFH reserves the right to reject any application without stating a reason.</li>
            <li>Each vendor account represents one brand. A single user may not operate multiple brand accounts simultaneously.</li>
            <li>Vendors must maintain their subscription plan to keep their storefront active and visible on the marketplace.</li>
          </ul>
        </Section>

        <Section title="8. Product Listings & Accuracy">
          <ul>
            <li>All listed products must be real, accurately described, and in the condition stated in the listing.</li>
            <li>Images must be of the actual product. Using stolen images or misleading media is strictly prohibited.</li>
            <li>Vendors are responsible for managing their own stock. Selling out-of-stock items is a policy violation.</li>
            <li>AFH reserves the right to remove any listing that violates community standards, is counterfeit, or is prohibited by Nigerian law.</li>
          </ul>
          <p><strong>Prohibited Items:</strong> Alcohol, tobacco, drugs, weapons, counterfeit goods, adult content, or anything that violates ABUAD campus regulations.</p>
        </Section>

        <Section title="9. Vendor Earnings, Escrow & Payouts">
          <ul>
            <li>Vendor earnings are held in escrow and only released after the customer confirms delivery of their order.</li>
            <li>Upon delivery confirmation, funds (minus the platform commission) are credited to your <strong>Wallet Balance</strong>.</li>
            <li>Withdrawal requests require a minimum balance of <strong>₦1,000</strong> and valid bank details saved in your dashboard settings.</li>
            <li>Payouts are processed within <strong>1–3 working days</strong> after a withdrawal request is approved by admin.</li>
            <li>Platform commission is deducted from each successful sale as per the current rate schedule visible in your dashboard.</li>
            <li>AFH is not responsible for delays caused by incorrect bank details provided by the vendor.</li>
          </ul>
        </Section>

        <Section title="10. Subscription Plans">
          <ul>
            <li><strong>Quarter Power (Free/Trial):</strong> 7-day trial with limited product listings. Requires upgrade for continued access.</li>
            <li><strong>Half Power:</strong> Monthly plan granting up to 50 product listings and 5 brand reels.</li>
            <li><strong>Full Power:</strong> Monthly plan granting unlimited listings, reels, and priority support.</li>
            <li>All subscription fees are non-refundable once payment is confirmed.</li>
            <li>AFH will send expiry reminders 3 days before a subscription lapses. An expired subscription suspends the vendor's storefront visibility.</li>
          </ul>
        </Section>

        <Section title="11. Vendor Responsibilities & Prohibited Conduct">
          <ul>
            <li>Vendors <strong>must fulfil orders within 48 hours</strong> of payment confirmation unless a longer timeline is stated in their shipping policy.</li>
            <li>Vendors must respond to in-app enquiries within a reasonable time.</li>
            <li>Vendors may not process transactions outside of the AFH platform to circumvent escrow or platform fees.</li>
            <li>Coordinating fake reviews, inflating follower counts, or any form of deceptive marketing is a permanent ban offence.</li>
          </ul>
        </Section>

        {/* Statement of Operations Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '3rem 0 2rem' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-gold)', fontWeight: 700, fontSize: '1rem' }}>
            <CheckCircle size={18} /> Statement of Operations
          </div>
          <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        </div>

        <div style={{ background: 'var(--bg-200)', border: '1px solid var(--border)', borderRadius: '16px', padding: '2rem', marginBottom: '2rem' }}>
          <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.2rem' }}>How ABUAD Fashion Hub Operates</h2>
          <p style={{ color: 'var(--text-300)', lineHeight: 1.8 }}>
            ABUAD Fashion Hub is a curated, closed-campus digital marketplace. Our operation model is built on <strong>trust, speed, and financial safety</strong> for all participants. We are not a store — we are an infrastructure that empowers campus entrepreneurs to sell and allows campus buyers to shop safely.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginTop: '1.5rem' }}>
            {[
              { icon: '🛒', title: 'Customer Journey', desc: 'Browse → Add to Cart → Pay via Paystack → Escrow holds funds → Vendor ships → Confirm delivery → Vendor paid.' },
              { icon: '🏪', title: 'Vendor Journey', desc: 'Apply → Admin approval → Pay activation fee → List products under subscription plan → Receive orders → Get paid.' },
              { icon: '🔒', title: 'Escrow System', desc: "All payments are held by the platform. Vendors receive funds ONLY after the customer confirms safe delivery." },
              { icon: '📊', title: 'Revenue Model', desc: 'Platform earns from activation fees, subscription plans, visibility boosts, and a commission on successful sales.' },
              { icon: '🚀', title: 'Visibility Engine', desc: 'Vendors can boost their rankings through tiered subscriptions and paid visibility boosts (Rodeo, Nitro, Apex).' },
              { icon: '🏦', title: 'Payouts', desc: 'Vendor wallets accumulate delivered-order earnings. Withdrawals are processed to verified bank accounts within 1–3 working days.' },
            ].map(item => (
              <div key={item.title} style={{ background: 'var(--bg-300)', borderRadius: '12px', padding: '1.25rem', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>{item.icon}</div>
                <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>{item.title}</h4>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-400)', lineHeight: 1.6 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <Section title="12. General Provisions">
          <ul>
            <li>AFH reserves the right to amend these terms at any time. Continued use of the platform after changes constitutes acceptance.</li>
            <li>AFH may suspend or terminate any account at its sole discretion for violations of these terms.</li>
            <li>These terms are governed by the laws of the Federal Republic of Nigeria.</li>
            <li>All disputes shall be resolved first through AFH mediation, and if unresolved, through the appropriate Nigerian judicial channels.</li>
          </ul>
        </Section>

        {/* Sponsor Footer */}
        <div style={{
          marginTop: '3rem',
          padding: '2rem',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(212,175,55,0.1), rgba(212,175,55,0.05))',
          border: '1px solid rgba(212,175,55,0.3)',
          textAlign: 'center',
        }}>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-400)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Sponsored &amp; Proudly Under</p>
          <h3 style={{ margin: '0.5rem 0 0', color: 'var(--accent-gold)', fontWeight: 900, fontSize: '1.1rem', letterSpacing: '0.05em' }}>
            MIGHTY SEEDS EXCEL INVESTMENT LTD.
          </h3>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', color: 'var(--text-400)' }}>Empowering campus commerce since inception.</p>
        </div>

        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <Link href="/" className="btn btn-ghost btn-sm">← Back to Home</Link>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '2rem' }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-100)', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
        {title}
      </h2>
      <div style={{ color: 'var(--text-300)', lineHeight: 1.8, fontSize: '0.93rem' }}>
        {children}
      </div>
    </div>
  );
}

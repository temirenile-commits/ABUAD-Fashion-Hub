'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar';
import MobileBottomNav from '@/components/MobileBottomNav';
import SplashScreen from '@/components/SplashScreen';
import WelcomeModal from '@/components/WelcomeModal';
import UpdatePrompt from '@/components/UpdatePrompt';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin') || pathname?.startsWith('/university-admin');

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <>
      <UpdatePrompt />
      <WelcomeModal />
      <SplashScreen />
      <Navbar />
      <div style={{ minHeight: 'calc(100vh - 64px)' }}>
        {children}
      </div>
      <MobileBottomNav />
      <footer
        style={{
          borderTop: '1px solid var(--border)',
          paddingTop: '3rem',
          marginTop: '4rem',
          background: 'var(--bg-100)',
          color: 'var(--text-300)',
          fontSize: '0.85rem',
        }}
      >
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', textAlign: 'left', marginBottom: '2rem' }}>
            <div>
              <h3 style={{ color: 'var(--primary)', marginBottom: '1rem', fontSize: '1rem' }}>Master Cart</h3>
              <p style={{ lineHeight: '1.6', opacity: 0.8 }}>The premier digital fashion marketplace for students and entrepreneurs at your University.</p>
              {/* Sponsor Badge */}
              <div style={{ marginTop: '1rem', padding: '0.6rem 0.9rem', background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.25)', borderRadius: '8px', display: 'inline-block' }}>
                <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--text-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sponsored &amp; Under</p>
                <p style={{ margin: '2px 0 0', fontWeight: 700, color: 'var(--accent-gold)', fontSize: '0.78rem' }}>MIGHTY SEEDS EXCEL INVESTMENT LTD.</p>
              </div>
            </div>
            <div>
              <h3 style={{ color: 'var(--text-100)', marginBottom: '1rem', fontSize: '1rem' }}>Quick Links</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <Link href="/explore" style={{ color: 'var(--text-400)', transition: 'color 0.2s' }}>Explore Marketplace</Link>
                <Link href="/vendors" style={{ color: 'var(--text-400)', transition: 'color 0.2s' }}>Browse Vendors</Link>
                <Link href="/onboarding" style={{ color: 'var(--text-400)', transition: 'color 0.2s' }}>Become a Vendor</Link>
                <Link href="/terms" style={{ color: 'var(--text-400)', transition: 'color 0.2s' }}>Terms &amp; Conditions</Link>
              </div>
            </div>
            <div>
              <h3 style={{ color: 'var(--text-100)', marginBottom: '1rem', fontSize: '1rem' }}>Contact Support</h3>
              <p>📞 +234 704 559 2604</p>
              <p>✉ lonewolfdevman@gmail.com</p>
            </div>
            <div>
              <h3 style={{ color: 'var(--text-100)', marginBottom: '1rem', fontSize: '1rem' }}>Developer</h3>
              <p style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '1rem' }}>Developed by the Lonewolfdevteam</p>
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem', paddingBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', opacity: 0.7, fontSize: '0.78rem' }}>
            <span>© 2026 Master Cart. All rights reserved. Empowering Campus Entrepreneurs.</span>
            <div style={{ display: 'flex', gap: '1.25rem' }}>
              <Link href="/terms" style={{ color: 'var(--text-400)' }}>Terms &amp; Conditions</Link>
              <Link href="/terms#vendor-terms" style={{ color: 'var(--text-400)' }}>Vendor Agreement</Link>
              <span style={{ color: 'var(--accent-gold)' }}>MIGHTY SEEDS EXCEL INVESTMENT LTD.</span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}

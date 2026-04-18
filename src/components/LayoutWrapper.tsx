'use client';
import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar';
import MobileBottomNav from '@/components/MobileBottomNav';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <>
      <Navbar />
      <div style={{ minHeight: 'calc(100vh - 64px)' }}>
        {children}
      </div>
      <MobileBottomNav />
      <footer
        style={{
          borderTop: '1px solid var(--border)',
          padding: '3rem 0',
          marginTop: '4rem',
          background: 'var(--bg-100)',
          color: 'var(--text-300)',
          fontSize: '0.85rem',
        }}
      >
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', textAlign: 'left', marginBottom: '2rem' }}>
            <div>
              <h3 style={{ color: 'var(--primary)', marginBottom: '1rem', fontSize: '1rem' }}>ABUAD Fashion Hub</h3>
              <p style={{ lineHeight: '1.5', opacity: 0.8 }}>The premier digital fashion marketplace for students and entrepreneurs at Afe Babalola University.</p>
            </div>
            <div>
              <h3 style={{ color: 'var(--text-100)', marginBottom: '1rem', fontSize: '1rem' }}>Contact Support</h3>
              <p>📞 +234 704 559 2604</p>
              <p>✉ lonewolfdevman@gmail.com</p>
            </div>
            <div>
              <h3 style={{ color: 'var(--text-100)', marginBottom: '1rem', fontSize: '1rem' }}>Developer</h3>
              <p>Built with ❤️ by </p>
              <p style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '1rem' }}>Lone Wolf Dev Team</p>
            </div>
          </div>
          
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem', textAlign: 'center', opacity: 0.6 }}>
            © 2026 ABUAD Fashion Hub. Empowering Campus Entrepreneurs.
          </div>
        </div>
      </footer>
    </>
  );
}

import type { Metadata, Viewport } from 'next';
import Navbar from '@/components/Navbar';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'ABUAD Fashion Hub – Campus Fashion Marketplace',
    template: '%s | ABUAD Fashion Hub',
  },
  description:
    'The premier digital fashion marketplace for students and entrepreneurs at Afe Babalola University. Discover trending styles, verified vendors, and campus fashion services.',
  keywords: ['ABUAD', 'fashion', 'campus', 'marketplace', 'clothing', 'style'],
  openGraph: {
    title: 'ABUAD Fashion Hub',
    description: 'Discover. Connect. Slay. The #1 campus fashion marketplace.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#08090a',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        {children}
        <footer
          style={{
            borderTop: '1px solid var(--border)',
            padding: '2rem 0',
            marginTop: '4rem',
            textAlign: 'center',
            color: 'var(--text-400)',
            fontSize: '0.85rem',
          }}
        >
          <div className="container">
            © 2026 ABUAD Fashion Hub. Empowering Campus Entrepreneurs.
          </div>
        </footer>
      </body>
    </html>
  );
}

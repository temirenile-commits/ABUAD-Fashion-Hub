import type { Metadata, Viewport } from 'next';
import { CartProvider } from '@/context/CartContext';
import { NotificationProvider } from '@/context/NotificationContext';
import RealtimeProvider from '@/components/providers/RealtimeProvider';
import LayoutWrapper from '@/components/LayoutWrapper';
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
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <RealtimeProvider>
          <CartProvider>
            <NotificationProvider>
              <LayoutWrapper>
                {children}
              </LayoutWrapper>
            </NotificationProvider>
          </CartProvider>
        </RealtimeProvider>
      </body>
    </html>
  );
}


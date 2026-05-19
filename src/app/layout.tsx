import type { Metadata, Viewport } from 'next';
import { CartProvider } from '@/context/CartContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { ToastProvider } from '@/context/ToastContext';
import { TourProvider } from '@/context/TourContext';
import RealtimeProvider from '@/components/providers/RealtimeProvider';
import LayoutWrapper from '@/components/LayoutWrapper';
import { ThemeProvider } from '@/context/ThemeContext';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://master-cart-camp.vercel.app'),
  title: {
    default: 'Master Cart – Campus Marketplace',
    template: '%s | Master Cart',
  },
  description:
    'The premier digital marketplace for students and entrepreneurs at your University. Discover trending items, verified vendors, and campus services.',
  keywords: ['Master Cart', 'fashion', 'campus', 'marketplace', 'clothing', 'style'],
  icons: {
    icon: [
      { url: '/logo.png', type: 'image/png' },
    ],
    apple: '/logo.png',
    shortcut: '/logo.png',
  },
  manifest: '/manifest.json',
  openGraph: {
    title: 'Master Cart',
    description: 'Discover. Connect. Slay. The #1 campus fashion marketplace.',
    type: 'website',
    images: [{ url: '/logo.png' }],
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || '',
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
        <ThemeProvider>
          <ToastProvider>
            <RealtimeProvider>
              <CartProvider>
                <NotificationProvider>
                  <TourProvider>
                    <LayoutWrapper>
                      {children}
                    </LayoutWrapper>
                  </TourProvider>
                </NotificationProvider>
              </CartProvider>
            </RealtimeProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}


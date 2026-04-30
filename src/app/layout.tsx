import type { Metadata, Viewport } from 'next';
import { CartProvider } from '@/context/CartContext';
import { NotificationProvider } from '@/context/NotificationContext';
import RealtimeProvider from '@/components/providers/RealtimeProvider';
import LayoutWrapper from '@/components/LayoutWrapper';
import { ThemeProvider } from '@/context/ThemeContext';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Master Cart – Campus Fashion Marketplace',
    template: '%s | Master Cart',
  },
  description:
    'The premier digital fashion marketplace for students and entrepreneurs at your University. Discover trending styles, verified vendors, and campus fashion services.',
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
          <RealtimeProvider>
            <CartProvider>
              <NotificationProvider>
                <LayoutWrapper>
                  {children}
                </LayoutWrapper>
              </NotificationProvider>
            </CartProvider>
          </RealtimeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}


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
  applicationName: 'MasterCart',
  title: {
    default: 'MasterCart – Campus Marketplace',
    template: '%s | MasterCart',
  },
  description:
    'The premier digital marketplace for students and entrepreneurs at your University. Discover trending items, verified vendors, and campus services.',
  keywords: ['MasterCart', 'fashion', 'campus', 'marketplace', 'clothing', 'style'],
  icons: {
    icon: [
      { url: '/logo.png', type: 'image/png' },
    ],
    apple: '/logo.png',
    shortcut: '/logo.png',
  },
  manifest: '/manifest.json',
  openGraph: {
    title: 'MasterCart',
    siteName: 'MasterCart',
    description: 'Discover. Connect. Slay. The #1 campus fashion marketplace.',
    type: 'website',
    images: [{ url: '/logo.png' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MasterCart',
    description: 'Discover. Connect. Slay. The #1 campus fashion marketplace.',
    site: '@MasterCart',
    creator: '@MasterCart',
    images: ['/logo.png'],
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
                      <script
                        type="application/ld+json"
                        dangerouslySetInnerHTML={{
                          __html: JSON.stringify({
                            '@context': 'https://schema.org',
                            '@graph': [
                              {
                                '@type': 'Organization',
                                '@id': 'https://master-cart-camp.vercel.app/#organization',
                                name: 'MasterCart',
                                url: 'https://master-cart-camp.vercel.app',
                                logo: 'https://master-cart-camp.vercel.app/logo.png',
                                sameAs: [
                                  'https://twitter.com/MasterCart',
                                  'https://instagram.com/MasterCart'
                                ]
                              },
                              {
                                '@type': 'WebSite',
                                '@id': 'https://master-cart-camp.vercel.app/#website',
                                url: 'https://master-cart-camp.vercel.app',
                                name: 'MasterCart',
                                publisher: {
                                  '@id': 'https://master-cart-camp.vercel.app/#organization'
                                },
                                potentialAction: {
                                  '@type': 'SearchAction',
                                  target: 'https://master-cart-camp.vercel.app/explore?q={search_term_string}',
                                  'query-input': 'required name=search_term_string'
                                }
                              }
                            ]
                          })
                        }}
                      />
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


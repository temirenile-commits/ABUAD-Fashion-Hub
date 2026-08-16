import type { Metadata, Viewport } from 'next';
import { CartProvider } from '@/context/CartContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { ToastProvider } from '@/context/ToastContext';
import { TourProvider } from '@/context/TourContext';
import RealtimeProvider from '@/components/providers/RealtimeProvider';
import LayoutWrapper from '@/components/LayoutWrapper';
import { ThemeProvider } from '@/context/ThemeContext';
import MilesPersistentBubble from '@/components/MilesPersistentBubble';
import MilesGlobalWorkspace from '@/components/MilesGlobalWorkspace';
import MilesOnboarding from '@/components/MilesOnboarding';
import { MilesConfigurationProvider } from '@/components/MilesConfigurationProvider';
import './globals.css';
import { getCanonicalSiteUrl } from '@/lib/site-url';

export const metadata: Metadata = {
  metadataBase: new URL(getCanonicalSiteUrl()),
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
      { url: '/favicon.ico', type: 'image/x-icon' },
      { url: '/branding/mastercart-icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/branding/mastercart-icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: '/branding/apple-touch-icon.png',
    shortcut: '/favicon.ico',
  },
  manifest: '/manifest.json',
  openGraph: {
    title: 'MasterCart',
    siteName: 'MasterCart',
    description: 'Discover. Connect. Slay. The #1 campus fashion marketplace.',
    type: 'website',
    images: [{ url: '/branding/mastercart-logo.png' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MasterCart',
    description: 'Discover. Connect. Slay. The #1 campus fashion marketplace.',
    site: '@MasterCart',
    creator: '@MasterCart',
    images: ['/branding/mastercart-logo.png'],
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
                    <MilesConfigurationProvider>
                      <LayoutWrapper>
                      <script
                        type="application/ld+json"
                        dangerouslySetInnerHTML={{
                          __html: JSON.stringify({
                            '@context': 'https://schema.org',
                            '@graph': [
                              {
                                '@type': 'Organization',
                                '@id': `${getCanonicalSiteUrl()}/#organization`,
                                name: 'MasterCart',
                                url: getCanonicalSiteUrl(),
                                logo: `${getCanonicalSiteUrl()}/branding/mastercart-mark.png`,
                                sameAs: [
                                  'https://twitter.com/MasterCart',
                                  'https://instagram.com/MasterCart'
                                ]
                              },
                              {
                                '@type': 'WebSite',
                                '@id': `${getCanonicalSiteUrl()}/#website`,
                                url: getCanonicalSiteUrl(),
                                name: 'MasterCart',
                                publisher: {
                                  '@id': `${getCanonicalSiteUrl()}/#organization`
                                },
                                potentialAction: {
                                  '@type': 'SearchAction',
                                  target: `${getCanonicalSiteUrl()}/explore?q={search_term_string}`,
                                  'query-input': 'required name=search_term_string'
                                }
                              }
                            ]
                          })
                        }}
                      />
                      {children}
                      <MilesPersistentBubble />
                      <MilesGlobalWorkspace />
                      <MilesOnboarding />
                      </LayoutWrapper>
                    </MilesConfigurationProvider>
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


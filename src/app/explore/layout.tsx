import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Explore Fashion & Essentials',
  description: 'Discover the best university marketplace products, fashion apparel, electronics, and daily essentials from trusted student vendors.',
  alternates: {
    canonical: '/explore',
  },
  openGraph: {
    title: 'Explore Fashion & Essentials | MasterCart',
    description: 'Shop top campus trends, daily essentials, and exclusive university fashion collections.',
    url: '/explore',
  },
};

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

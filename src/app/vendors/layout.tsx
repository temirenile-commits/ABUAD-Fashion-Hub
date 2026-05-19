import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Official Campus Vendors & Brands',
  description: 'Browse all verified student entrepreneurs, official university brands, and local campus shops.',
  alternates: {
    canonical: '/vendors',
  },
  openGraph: {
    title: 'Verified Vendors Directory | MasterCart',
    description: 'Find trusted sellers on campus. Support student entrepreneurs and shop safely.',
    url: '/vendors',
  },
};

export default function VendorsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

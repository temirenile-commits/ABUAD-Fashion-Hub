import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Campus Brands Directory',
  description: 'Discover and shop from verified fashion brands and vendors at ABUAD.',
};

export default function VendorsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

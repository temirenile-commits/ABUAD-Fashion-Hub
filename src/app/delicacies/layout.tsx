import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MasterCart Delicacies',
  description: 'Order fresh meals, snacks, and local cuisine from the best campus chefs. Fast delivery and premium taste.',
  alternates: {
    canonical: '/delicacies',
  },
  openGraph: {
    title: 'MasterCart Delicacies | Campus Food Delivery',
    description: 'Explore mouth-watering delicacies from verified student chefs and campus restaurants.',
    url: '/delicacies',
  },
};

export default function DelicaciesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

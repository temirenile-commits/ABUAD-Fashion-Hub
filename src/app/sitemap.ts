import { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabase';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://master-cart-camp.vercel.app';

  // 1. Static Pages
  const staticPages = [
    '',
    '/explore',
    '/vendors',
    '/reels',
    '/services',
    '/rankings',
    '/delicacies',
    '/delicacies/rankings',
    '/privacy',
    '/terms',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1.0 : 0.8,
  }));

  // 2. Dynamic Products (Including Delicacies)
  let productPages: any[] = [];
  try {
    const { data: products } = await supabase
      .from('products')
      .select('id, created_at')
      .eq('is_draft', false)
      .order('created_at', { ascending: false })
      .limit(1000);
      
    if (products) {
      productPages = products.map((p) => ({
        url: `${baseUrl}/product/${p.id}`,
        lastModified: new Date(p.created_at),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }));
    }
  } catch (e) {
    console.error('Sitemap product query failed:', e);
  }

  // 3. Dynamic Vendors
  let vendorPages: any[] = [];
  try {
    const { data: brands } = await supabase
      .from('brands')
      .select('id, owner_id, created_at')
      .order('created_at', { ascending: false })
      .limit(1000);
      
    if (brands) {
      vendorPages = brands.map((b) => ({
        url: `${baseUrl}/vendor/${b.id}?id=${b.id}`, // using id as slug fallback
        lastModified: new Date(b.created_at),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }));
    }
  } catch (e) {
    console.error('Sitemap brand query failed:', e);
  }

  return [...staticPages, ...productPages, ...vendorPages];
}

import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
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
    lastModified: new Date().toISOString(),
    changeFrequency: 'daily',
    priority: route === '' ? '1.0' : '0.8',
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
        lastModified: new Date(p.created_at).toISOString(),
        changeFrequency: 'weekly',
        priority: '0.7',
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
      .select('id, created_at')
      .order('created_at', { ascending: false })
      .limit(1000);
      
    if (brands) {
      vendorPages = brands.map((b) => ({
        url: `${baseUrl}/vendor/${b.id}?id=${b.id}`, // using id as slug fallback
        lastModified: new Date(b.created_at).toISOString(),
        changeFrequency: 'weekly',
        priority: '0.6',
      }));
    }
  } catch (e) {
    console.error('Sitemap brand query failed:', e);
  }

  const allPages = [...staticPages, ...productPages, ...vendorPages];

  // Build the XML content with the XSLT stylesheet reference
  const xmlItems = allPages
    .map(
      (page) => `  <url>
    <loc>${page.url.replace(/&/g, '&amp;')}</loc>
    <lastmod>${page.lastModified}</lastmod>
    <changefrequency>${page.changeFrequency}</changefrequency>
    <priority>${page.priority}</priority>
  </url>`
    )
    .join('\n');

  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlItems}
</urlset>`;

  return new Response(xmlContent, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=18000',
    },
  });
}

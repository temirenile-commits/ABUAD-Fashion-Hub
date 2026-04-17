import { notFound } from 'next/navigation';
import Image from 'next/image';
import { CheckCircle, MessageCircle, Star, Package, Users, Calendar } from 'lucide-react';
import { supabaseAdmin } from '@/lib/supabase-admin';
import ProductCard, { LiveProduct } from '@/components/ProductCard';
import styles from './vendor.module.css';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ id?: string }>;
}

export async function generateMetadata({ params, searchParams }: Props) {
  const { id } = await searchParams;
  const { slug } = await params;

  if (!id) return { title: 'Brand' };

  const { data: vendor } = await supabaseAdmin
    .from('brands')
    .select('name, description')
    .eq('id', id)
    .single();

  if (!vendor) return { title: 'Vendor Not Found' };
  return { title: `${vendor.name} – Campus Brand`, description: vendor.description };
}

export default async function VendorPage({ params, searchParams }: Props) {
  const { id } = await searchParams;
  const { slug } = await params;

  if (!id) notFound();

  // Fetch brand data
  const { data: vendorData, error: vendorError } = await supabaseAdmin
    .from('brands')
    .select('*')
    .eq('id', id)
    .single();

  if (vendorError || !vendorData) notFound();

  // Fetch vendor products
  const { data: productsData } = await supabaseAdmin
    .from('products')
    .select(`
      *,
      brands (name, whatsapp_number)
    `)
    .eq('brand_id', id);

  const vendorProducts = (productsData || []) as any[] as LiveProduct[];
  const vendor = vendorData;
  
  const waMessage = `Hi ${vendor.name}! I found you on ABUAD Fashion Hub. I'd love to know more about your products.`;
  const whatsapp = vendor.whatsapp_number.replace('+', '');
  const fallbackCover = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&auto=format&fit=crop';

  return (
    <main>
      {/* Cover */}
      <div className={styles.cover}>
        <Image
          src={fallbackCover}
          alt={vendor.name}
          fill
          priority
          sizes="100vw"
          className={styles.coverImg}
        />
        <div className={styles.coverOverlay} />
      </div>

      <div className="container">
        {/* Profile Row */}
        <div className={styles.profileRow}>
          <div className={styles.logoWrap}>
            <span className={styles.logoText}>
              {vendor.logo_url && vendor.logo_url.startsWith('http') ? (
                <Image src={vendor.logo_url} alt={vendor.name} fill style={{objectFit: 'cover', borderRadius: '12px'}} />
              ) : (
                vendor.name.substring(0, 2).toUpperCase()
              )}
            </span>
          </div>

          <div className={styles.profileInfo}>
            <div className={styles.nameRow}>
              <h1 className={styles.name}>{vendor.name}</h1>
              {vendor.verified && (
                <div className={styles.verifiedPill}>
                  <CheckCircle size={14} />
                  <span>Verified Brand</span>
                </div>
              )}
            </div>
            <span className={`badge badge-teal`}>Fashion</span>
            <p className={styles.description}>{vendor.description}</p>
          </div>

          <div className={styles.profileActions}>
            <a
              href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(waMessage)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-whatsapp"
            >
              <MessageCircle size={16} /> Chat Vendor
            </a>
            <button className="btn btn-ghost">Follow</button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className={styles.statsBar}>
          {[
            { icon: <Star size={16} />, value: '4.8', label: 'Rating' },
            { icon: <Package size={16} />, value: vendorProducts.length, label: 'Products' },
            { icon: <Users size={16} />, value: '1.2k', label: 'Followers' },
            { icon: <Calendar size={16} />, value: new Date(vendor.created_at).getFullYear(), label: 'Member Since' },
          ].map(({ icon, value, label }) => (
            <div key={label} className={styles.statItem}>
              {icon}
              <div>
                <span className={styles.statValue}>{value}</span>
                <span className={styles.statLabel}>{label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Products */}
        <section className={styles.productsSection}>
          <h2 className={styles.productsTitle}>
            {vendorProducts.length > 0
              ? `All Products (${vendorProducts.length})`
              : 'No products listed yet'}
          </h2>

          {vendorProducts.length > 0 ? (
            <div className={styles.productsGrid}>
              {vendorProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className={styles.emptyProducts}>
              <p>This vendor hasn&apos;t listed any products yet. Check back soon!</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

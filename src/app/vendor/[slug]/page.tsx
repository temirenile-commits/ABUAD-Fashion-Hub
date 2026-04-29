import { notFound } from 'next/navigation';
import Image from 'next/image';
import { CheckCircle, MessageCircle, Star, Package, Users, Calendar } from 'lucide-react';
import { supabaseAdmin } from '@/lib/supabase-admin';
import ProductCard, { LiveProduct } from '@/components/ProductCard';
import VividVideo from '@/components/VividVideo';
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
    .select('name, description, logo_url')
    .eq('id', id)
    .single();

  if (!vendor) return { title: 'Vendor Not Found' };
  
  const ogImage = vendor.logo_url || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2070';

  return { 
    title: `${vendor.name} – Campus Brand`, 
    description: vendor.description,
    openGraph: {
      title: vendor.name,
      description: vendor.description,
      images: [
        {
          url: ogImage,
          width: 800,
          height: 800,
          alt: vendor.name,
        },
      ],
    },
    twitter: {
      card: 'summary',
      title: vendor.name,
      description: vendor.description,
      images: [ogImage],
    },
  };
}

import VendorActions from './VendorActions';

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
    .eq('brand_id', id)
    .eq('is_draft', false);

  // Fetch vendor reels
  const { data: reelsData } = await supabaseAdmin
    .from('brand_reels')
    .select('*')
    .eq('brand_id', id);

  const vendorProducts = (productsData || []) as any[] as LiveProduct[];
  const vendor = vendorData;
  
  const fallbackCover = 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2070';

  return (
    <main>
      {/* Cover */}
      <div className={styles.cover}>
        <Image
          src={vendor.cover_url || fallbackCover}
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
                <Image src={vendor.logo_url} alt={vendor.name || 'Brand'} fill style={{objectFit: 'cover', borderRadius: '12px'}} />
              ) : (
                (vendor.name || 'AF').substring(0, 2).toUpperCase()
              )}
            </span>
          </div>

          <div className={styles.profileInfo}>
            <div className={styles.nameRow}>
              <h1 className={styles.name}>{vendor.name || 'Anonymous Brand'}</h1>
              {vendor.verified && (
                <div className={styles.verifiedPill}>
                  <CheckCircle size={14} />
                  <span>Verified Brand</span>
                </div>
              )}
            </div>
            <span className={`badge badge-teal`}>{vendor.brand_type || 'Fashion'}</span>
            <p className={styles.description}>{vendor.description}</p>
          </div>

          <div className={styles.profileActions}>
            <VendorActions 
              vendorId={vendor.id} 
              vendorName={vendor.name} 
              whatsappNumber={vendor.whatsapp_number}
              initialFollowers={vendor.followers_count || 0}
            />
          </div>
        </div>

        {/* Stats Bar */}
        <div className={styles.statsBar}>
          {[
             { icon: <Star size={16} />, value: Number(vendor.rating || 0).toFixed(1), label: 'Rating' },
             { icon: <Package size={16} />, value: vendorProducts.length, label: 'Products' },
             { icon: <Users size={16} />, value: (vendor.followers_count || 0) > 1000 ? `${((vendor.followers_count || 0)/1000).toFixed(1)}k` : (vendor.followers_count || 0), label: 'Followers' },
             { icon: <Calendar size={16} />, value: new Date(vendor.created_at).getFullYear(), label: 'Member Since' },
             { icon: <Package size={16} />, value: reelsData?.length || 0, label: 'Reels' },
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

        {/* Reels Section */}
        {reelsData && reelsData.length > 0 && (
          <section className={styles.productsSection} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '3rem', marginBottom: '3rem' }}>
            <h2 className={styles.productsTitle}>Collection Reels</h2>
            <div className={styles.reelsGrid}>
              {reelsData.map((reel) => (
                <div key={reel.id} className={styles.reelCard}>
                  <VividVideo 
                    src={reel.video_url} 
                    className={styles.reelVideo}
                  />
                  {reel.title && <div className={styles.reelTitleOverlay}>{reel.title}</div>}
                </div>
              ))}
            </div>
          </section>
        )}

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

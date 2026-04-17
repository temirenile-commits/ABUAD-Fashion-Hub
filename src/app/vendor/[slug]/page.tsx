import { notFound } from 'next/navigation';
import Image from 'next/image';
import { CheckCircle, MessageCircle, Star, Package, Users, Calendar } from 'lucide-react';
import { VENDORS, PRODUCTS } from '@/lib/data';
import ProductCard from '@/components/ProductCard';
import styles from './vendor.module.css';

export async function generateStaticParams() {
  return VENDORS.map((v) => ({ slug: v.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const vendor = VENDORS.find((v) => v.slug === slug);
  if (!vendor) return { title: 'Vendor Not Found' };
  return { title: `${vendor.name} – Campus Brand`, description: vendor.description };
}

export default async function VendorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const vendor = VENDORS.find((v) => v.slug === slug);
  if (!vendor) notFound();

  const vendorProducts = PRODUCTS.filter((p) => p.brandId === vendor.id);
  const waMessage = `Hi ${vendor.name}! I found you on ABUAD Fashion Hub. I'd love to know more about your products.`;

  return (
    <main>
      {/* Cover */}
      <div className={styles.cover}>
        <Image
          src={vendor.coverImage}
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
            <span className={styles.logoText}>{vendor.logo}</span>
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
            <span className={`badge badge-teal`}>{vendor.category}</span>
            <p className={styles.description}>{vendor.description}</p>
          </div>

          <div className={styles.profileActions}>
            <a
              href={`https://wa.me/${vendor.whatsapp}?text=${encodeURIComponent(waMessage)}`}
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
            { icon: <Star size={16} />, value: vendor.rating, label: 'Rating' },
            { icon: <Package size={16} />, value: vendor.products, label: 'Products' },
            { icon: <Users size={16} />, value: vendor.followers, label: 'Followers' },
            { icon: <Calendar size={16} />, value: `${vendor.joinedYear}`, label: 'Member Since' },
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

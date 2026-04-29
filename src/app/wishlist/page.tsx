'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Heart, ShoppingBag, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import ProductCard, { LiveProduct } from '@/components/ProductCard';
import styles from './wishlist.module.css';

export default function WishlistPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [wishlist, setWishlist] = useState<LiveProduct[]>([]);

  useEffect(() => {
    async function fetchWishlist() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/login?redirect=/wishlist');
        return;
      }

      const { data, error } = await supabase
        .from('wishlists')
        .select(`
          product_id,
          products (
            *,
            brands (id, name, verified, whatsapp_number, logo_url)
          )
        `)
        .eq('user_id', session.user.id);

      if (error) {
        console.error(error);
      } else {
        const products = data.map((item: any) => item.products).filter(Boolean);
        setWishlist(products);
      }
      setLoading(false);
    }
    fetchWishlist();
  }, [router]);

  if (loading) {
    return (
      <div className={styles.loading}>
        <Loader2 className="anim-spin" size={32} color="var(--primary)" />
        <p>Opening your wishlist...</p>
      </div>
    );
  }

  return (
    <main className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <div className={styles.titleArea}>
            <Heart size={32} fill="var(--primary)" color="var(--primary)" />
            <h1>Your Wishlist</h1>
          </div>
          <p className={styles.subtitle}>All the items you&apos;ve loved and saved for later.</p>
        </div>

        {wishlist.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <Heart size={48} />
            </div>
            <h2>Your wishlist is empty</h2>
            <p>Start exploring the marketplace and tap the heart icon on items you like!</p>
            <Link href="/explore" className="btn btn-primary">
              Explore Products <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <div className={styles.grid}>
            {wishlist.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

'use client';
import Link from 'next/link';
import { Shirt, User, Gem, Watch, ShoppingBag, Sparkles } from 'lucide-react';
import styles from './TopCategories.module.css';

const TOP_CATS = [
  { id: 'Mens-Fashion', label: "Men's", icon: <User size={24} />, color: '#fee2e2' },
  { id: 'Womens-Fashion', label: "Women's", icon: <Sparkles size={24} />, color: '#fef3c7' },
  { id: 'Footwear', label: "Shoes", icon: <Shirt size={24} />, color: '#dcfce7' },
  { id: 'Accessories', label: "Accs", icon: <Watch size={24} />, color: '#dbeafe' },
  { id: 'Bags', label: "Bags", icon: <ShoppingBag size={24} />, color: '#f3e8ff' },
  { id: 'Jewelry', label: "Luxury", icon: <Gem size={24} />, color: '#fae8ff' },
];

export default function TopCategories() {
  return (
    <div className={styles.grid}>
      {TOP_CATS.map((cat) => (
        <Link key={cat.id} href={`/explore?category=${cat.id}`} className={styles.item}>
          <div className={styles.circle} style={{ backgroundColor: 'var(--bg-100)' }}>
            <div className={styles.iconBox}>
               {cat.icon}
            </div>
          </div>
          <span>{cat.label}</span>
        </Link>
      ))}
    </div>
  );
}

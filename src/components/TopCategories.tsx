'use client';
import Link from 'next/link';
import { Shirt, User, Gem, Watch, ShoppingBag, Sparkles, Zap } from 'lucide-react';
import styles from './TopCategories.module.css';

const TOP_CATS = [
  { id: 'Fashion', label: "Fashion", icon: <User size={24} />, color: '#FFFFFF' },
  { id: 'Electronics', label: "Tech", icon: <Zap size={24} />, color: '#FFFFFF' },
  { id: 'Beauty-Personal-Care', label: "Beauty", icon: <Sparkles size={24} />, color: '#FFFFFF' },
  { id: 'Home-Living', label: "Home", icon: <ShoppingBag size={24} />, color: '#FFFFFF' },
  { id: 'Phones-Accessories', label: "Phones", icon: <Watch size={24} />, color: '#FFFFFF' },
  { id: 'General-Merchandise', label: "General", icon: <Gem size={24} />, color: '#FFFFFF' },
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

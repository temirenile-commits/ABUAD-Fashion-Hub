'use client';
import Link from 'next/link';
import { 
  Shirt, 
  User, 
  Watch, 
  ShoppingBag, 
  Scissors, 
  Camera, 
  Sparkles, 
  Gem, 
  Zap,
  ChevronRight
} from 'lucide-react';
import styles from './CategorySidebar.module.css';

const CATEGORIES = [
  { id: 'Fashion', label: "Fashion", icon: <User size={18} /> },
  { id: 'Electronics', label: "Electronics", icon: <Zap size={18} /> },
  { id: 'Phones-Accessories', label: "Phones & Accessories", icon: <Watch size={18} /> },
  { id: 'Beauty-Personal-Care', label: "Beauty & Personal Care", icon: <Sparkles size={18} /> },
  { id: 'Home-Living', label: "Home & Living", icon: <ShoppingBag size={18} /> },
  { id: 'Gadgets', label: "Gadgets", icon: <Camera size={18} /> },
  { id: 'General-Merchandise', label: "General Merchandise", icon: <Gem size={18} /> },
];

export default function CategorySidebar() {
  return (
    <div className={styles.sidebar}>
      {CATEGORIES.map((cat) => (
        <Link key={cat.id} href={`/explore?category=${cat.id}`} className={styles.item}>
          <div className={styles.left}>
            {cat.icon}
            <span>{cat.label}</span>
          </div>
          <ChevronRight size={14} className={styles.arrow} />
        </Link>
      ))}
    </div>
  );
}

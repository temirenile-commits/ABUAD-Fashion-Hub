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
  { id: 'Mens-Fashion', label: "Men's Fashion", icon: <User size={18} /> },
  { id: 'Womens-Fashion', label: "Women's Fashion", icon: <Sparkles size={18} /> },
  { id: 'Traditional-Wear', label: "Traditional & Native", icon: <Scissors size={18} /> },
  { id: 'Footwear', label: "Footwear", icon: <Shirt size={18} /> },
  { id: 'Accessories', label: "Style Accessories", icon: <Watch size={18} /> },
  { id: 'Bags', label: "Bags & Purses", icon: <ShoppingBag size={18} /> },
  { id: 'Fabrics', label: "Fabrics & Textiles", icon: <Zap size={18} /> },
  { id: 'Jewelry', label: "Jewelry", icon: <Gem size={18} /> },
  { id: 'Tailoring', label: "Tailoring Services", icon: <Scissors size={18} /> },
  { id: 'Photography', label: "Fashion Shoots", icon: <Camera size={18} /> },
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

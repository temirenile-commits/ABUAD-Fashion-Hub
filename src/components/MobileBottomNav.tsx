'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Search, ShoppingBag, Bell, User } from 'lucide-react';
import styles from './MobileBottomNav.module.css';
import { useCart } from '@/context/CartContext';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { getItemCount } = useCart();
  const cartCount = getItemCount();

  const navItems = [
    { href: '/', label: 'Home', icon: <Home size={22} /> },
    { href: '/explore', label: 'Explore', icon: <Search size={22} /> },
    { href: '/notifications', label: 'Notifications', icon: <Bell size={22} /> },
    { href: '/dashboard/customer', label: 'Account', icon: <User size={22} /> },
  ];

  return (
    <nav className={styles.nav}>
      {navItems.map((item) => (
        <Link 
          key={item.href} 
          href={item.href} 
          className={`${styles.navItem} ${pathname === item.href ? styles.active : ''}`}
        >
          {item.icon}
          <span>{item.label}</span>
        </Link>
      ))}
      <Link 
        href="/checkout" 
        className={`${styles.navItem} ${pathname === '/checkout' ? styles.active : ''}`}
      >
        <div className={styles.iconWrap}>
          <ShoppingBag size={22} />
          {cartCount > 0 && <span className={styles.badge}>{cartCount}</span>}
        </div>
        <span>Cart</span>
      </Link>
    </nav>
  );
}

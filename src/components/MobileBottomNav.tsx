'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Home, Search, ShoppingBag, Bell, User, Store } from 'lucide-react';
import styles from './MobileBottomNav.module.css';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabase';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { getItemCount } = useCart();
  const cartCount = getItemCount();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single();
        if (data) setRole(data.role);
      }
    });
  }, []);

  const accountLink = role === 'vendor' ? '/dashboard/vendor' : '/dashboard/customer';
  const accountLabel = role === 'vendor' ? 'My Store' : 'Account';
  const AccountIcon = role === 'vendor' ? Store : User;

  const navItems = [
    { href: '/', label: 'Home', icon: <Home size={22} /> },
    { href: '/explore', label: 'Explore', icon: <Search size={22} /> },
    { href: '/notifications', label: 'Alerts', icon: <Bell size={22} /> },
    { href: accountLink, label: accountLabel, icon: <AccountIcon size={22} /> },
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
        href="/cart" 
        className={`${styles.navItem} ${pathname === '/cart' ? styles.active : ''}`}
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

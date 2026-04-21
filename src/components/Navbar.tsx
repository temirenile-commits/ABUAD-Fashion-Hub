'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Search, Heart, User, Menu, X, Store, Home, Layers, LogOut, LayoutDashboard, ShoppingBag, MessageCircle, Bell, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/context/CartContext';
import CartDrawer from './CartDrawer';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { getItemCount } = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Check session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUser(session.user);
        // Fetch role
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single();
        if (userData) setRole(userData.role);
      }
    };
    checkSession();

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        setUser(session.user);
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single();
        if (userData) setRole(userData.role);
      } else {
        setUser(null);
        setRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const navLinks = [
    { href: '/', label: 'Home', icon: <Home size={16} /> },
    { href: '/explore', label: 'Explore', icon: <Search size={16} /> },
    { href: '/vendors', label: 'Vendors', icon: <Store size={16} /> },
    { href: '/services', label: 'Services', icon: <Layers size={16} /> },
  ];

  const dashboardLink = role === 'vendor' ? '/dashboard/vendor' : '/dashboard/customer';

  return (
    <header className={styles.header}>
      <nav className={`container-wide ${styles.nav}`}>
        {/* Logo */}
        <Link href="/" className={styles.logo}>
          <div className={styles.logoIcon}>AFH</div>
          <div className={styles.logoText}>
            <span className="text-gradient">ABUAD</span>
            <span className={styles.logoSub}>Fashion Hub</span>
          </div>
        </Link>

        {/* Search Bar (Jumia Style - Center) */}
        <div className={styles.searchBar}>
          <Search size={18} className={styles.searchIcon} />
          <input type="text" placeholder="Search products, brands and services..." />
          <button className={styles.searchBtn}>SEARCH</button>
        </div>

        {/* Actions (Right) */}
        <div className={styles.actions}>
          {user ? (
            <>
              {role === 'admin' && (
                <div className={styles.actionItem}>
                  <Link href="/admin" className={styles.actionLink} style={{ color: 'var(--accent-gold)' }}>
                    <LayoutDashboard size={20} />
                    <span>Admin Panel</span>
                  </Link>
                </div>
              )}
              <div className={styles.actionItem}>
                <Link href={dashboardLink} className={styles.actionLink}>
                  <User size={20} />
                  <span>Account</span>
                </Link>
              </div>
              <div className={styles.actionItem}>
                <button onClick={handleLogout} className={styles.actionLink} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <LogOut size={20} />
                  <span>Logout</span>
                </button>
              </div>
            </>
          ) : (
            <div className={styles.actionItem}>
              <Link href="/auth/login" className={styles.actionLink}>
                <User size={20} />
                <span>Login</span>
              </Link>
            </div>
          )}

          <div className={styles.actionItem}>
            <Link href="/notifications" className={styles.actionLink} aria-label="Notifications">
              <Bell size={20} />
            </Link>
          </div>

          <div className={styles.actionItem}>
            <Link href="https://wa.me/2347045592604" target="_blank" className={styles.actionLink}>
              <MessageCircle size={20} />
              <span>Help</span>
            </Link>
          </div>

          <button 
            className={styles.cartBtn} 
            onClick={() => setCartOpen(true)}
          >
            <div className={styles.iconWrap}>
              <ShoppingBag size={20} />
              {getItemCount() > 0 && <span className={styles.cartBadge}>{getItemCount()}</span>}
            </div>
            <span>Cart</span>
          </button>
        </div>
      </nav>

      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />

      {/* Category Quick Bar */}
      <div className={styles.categoryBar}>
        <div className={`container-wide ${styles.categoryInner}`}>
          {['All', 'Clothing', 'Footwear', 'Bags', 'Accessories', 'Jewelry', 'Makeup', 'Photography', 'Tailoring'].map(cat => (
            <Link key={cat} href={`/explore?category=${cat}`} className={styles.catPill}>
              {cat}
            </Link>
          ))}
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className={styles.mobileMenu}>
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={styles.mobileLink}
              onClick={() => setMenuOpen(false)}
            >
              {link.icon} {link.label}
            </Link>
          ))}
          <div className={styles.mobileDivider} />
          {user ? (
            <>
              {role === 'admin' && (
                <Link href="/admin" className={styles.mobileLink} onClick={() => setMenuOpen(false)} style={{ color: 'var(--accent-gold)' }}>
                  <ShieldCheck size={16} /> Admin Panel
                </Link>
              )}
              <Link href={dashboardLink} className={styles.mobileLink} onClick={() => setMenuOpen(false)}>
                <LayoutDashboard size={16} /> Dashboard
              </Link>
              <button 
                onClick={() => { handleLogout(); setMenuOpen(false); }} 
                className={`${styles.mobileLink} ${styles.logoutBtn}`}
              >
                <LogOut size={16} /> Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="btn btn-ghost" onClick={() => setMenuOpen(false)}>
                Login
              </Link>
              <Link href="/auth/register" className="btn btn-primary" onClick={() => setMenuOpen(false)}>
                Join Free
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}

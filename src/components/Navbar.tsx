'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Search, Heart, User, Menu, X, Store, Home, Layers, LogOut, LayoutDashboard, ShoppingBag, MessageCircle } from 'lucide-react';
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
          <span className={styles.logoIcon}>AF</span>
          <span>
            <span className="text-gradient">ABUAD</span>{' '}
            <span className={styles.logoSub}>Fashion Hub</span>
          </span>
        </Link>

        {/* Desktop Links */}
        <div className={styles.navLinks}>
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`${styles.navLink} ${pathname === link.href ? styles.active : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Search Bar (desktop) */}
        <div className={styles.searchBar}>
          <Search size={15} className={styles.searchIcon} />
          <input type="text" placeholder="Search products, brands..." />
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <Link href="/wishlist" className="btn btn-icon btn-ghost" aria-label="Wishlist">
            <Heart size={18} />
          </Link>

          <button 
            className={`btn btn-icon btn-ghost ${styles.cartTrigger}`} 
            aria-label="Toggle Cart"
            onClick={() => setCartOpen(true)}
          >
            <ShoppingBag size={19} />
            {getItemCount() > 0 && <span className={styles.cartBadge}>{getItemCount()}</span>}
          </button>
          
          {user ? (
            <div className={styles.userMenu}>
              <Link href={dashboardLink} className="btn btn-secondary btn-sm">
                <LayoutDashboard size={15} /> Dashboard
              </Link>
              <button onClick={handleLogout} className="btn btn-ghost btn-sm" aria-label="Logout">
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <>
              <Link href="/auth/login" className="btn btn-secondary btn-sm">
                <User size={15} /> Login
              </Link>
              <Link href="/auth/register" className="btn btn-primary btn-sm">
                Join Free
              </Link>
            </>
          )}

          <button
            className={`${styles.menuToggle}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
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

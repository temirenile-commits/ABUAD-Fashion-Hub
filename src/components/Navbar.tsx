'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Search, Heart, User, Menu, X, Store, Home, Layers, LogOut, LayoutDashboard, ShoppingBag, MessageCircle, Bell, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/context/CartContext';
import { useNotifications } from '@/context/NotificationContext';
import CartDrawer from './CartDrawer';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { getItemCount } = useCart();
  const { unreadCount, requestPermission, permission, markAllRead } = useNotifications();
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
        // Fetch role and avatar
        const { data: userData } = await supabase
          .from('users')
          .select('role, avatar_url')
          .eq('id', session.user.id)
          .single();
        if (userData) {
          setRole(userData.role);
          if (userData.avatar_url) {
            setUser((prev: any) => ({ ...prev, avatar_url: userData.avatar_url }));
          }
        }
      }
    };
    checkSession();

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        setUser(session.user);
        const { data: userData } = await supabase
          .from('users')
          .select('role, avatar_url')
          .eq('id', session.user.id)
          .single();
        if (userData) {
          setRole(userData.role);
          if (userData.avatar_url) {
             setUser((prev: any) => ({ ...prev, avatar_url: userData.avatar_url }));
          }
        }
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

  const dashboardLink = role === 'vendor' ? '/dashboard/vendor' : role === 'delivery' ? '/dashboard/delivery' : '/dashboard/customer';

  return (
    <header className={styles.header}>
      <nav className={`container-wide ${styles.nav}`}>
        {/* Logo */}
        <Link href="/" className={styles.logo}>
          <img src="/logo.png" alt="Logo" className={styles.logoImg} />
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
              {/* Notification (Always Visible) */}
              <div className={styles.actionItem}>
                <Link
                  href="/notifications"
                  className={styles.actionLink}
                  aria-label="Notifications"
                  onClick={() => markAllRead()}
                >
                  <div className={styles.iconWrap}>
                    <Bell size={20} />
                    {unreadCount > 0 && (
                      <span className={styles.cartBadge} style={{ background: '#ef4444', color: '#fff' }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </div>
                </Link>
              </div>

              {/* Account Profile Pic (Always Visible) */}
              <div className={styles.actionItem}>
                <Link href={dashboardLink} className={styles.actionLink} title="Account">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }} />
                  ) : (
                    <div className={styles.avatarPlaceholder}>
                      <User size={18} />
                    </div>
                  )}
                </Link>
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

          {/* Options Module Toggle */}
          <div className={styles.actionItem} style={{ position: 'relative' }}>
            <button 
              className={styles.optionsToggle} 
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="More options"
            >
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* The Options Module Dropdown */}
            {menuOpen && (
              <div className={styles.optionsModule} onClick={() => setMenuOpen(false)}>
                {/* Main Nav Links (Mobile Only or Always for consistency) */}
                <div className={styles.mobileOnlyLinks}>
                  {navLinks.map(link => (
                    <Link key={link.href} href={link.href} className={styles.moduleItem}>
                      {link.icon}
                      <span>{link.label}</span>
                    </Link>
                  ))}
                  <div className={styles.moduleDivider} />
                </div>

                {role === 'admin' && (
                  <Link href="/admin" className={`${styles.moduleItem} ${styles.adminModuleLink}`}>
                    <ShieldCheck size={18} />
                    <span>Admin Panel</span>
                  </Link>
                )}
                {(role === 'vendor' || role === 'admin') && (
                  <Link href="/dashboard/vendor" className={styles.moduleItem}>
                    <Store size={18} />
                    <span>Vendor Dashboard</span>
                  </Link>
                )}
                {role === 'delivery' && (
                  <Link href="/dashboard/delivery" className={styles.moduleItem}>
                    <ShoppingBag size={18} />
                    <span>Agent Dashboard</span>
                  </Link>
                )}
                <Link href="https://wa.me/2347045592604" target="_blank" className={styles.moduleItem}>
                  <MessageCircle size={18} />
                  <span>Help Center</span>
                </Link>
                <button 
                  onClick={(e) => { e.stopPropagation(); setCartOpen(true); setMenuOpen(false); }} 
                  className={styles.moduleItem}
                >
                  <div className={styles.iconWrap}>
                    <ShoppingBag size={18} />
                    {getItemCount() > 0 && <span className={styles.cartBadge}>{getItemCount()}</span>}
                  </div>
                  <span>Cart</span>
                </button>
                <div className={styles.moduleDivider} />
                {user ? (
                  <button onClick={handleLogout} className={`${styles.moduleItem} ${styles.logoutModuleBtn}`}>
                    <LogOut size={18} />
                    <span>Logout</span>
                  </button>
                ) : (
                  <>
                    <Link href="/auth/login" className={styles.moduleItem}>
                      <User size={18} />
                      <span>Login</span>
                    </Link>
                    <Link href="/auth/register" className={styles.moduleItem}>
                      <ShieldCheck size={18} />
                      <span>Join Free</span>
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
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
    </header>
  );
}

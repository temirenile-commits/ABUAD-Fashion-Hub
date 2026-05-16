'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Search, Heart, User, Menu, X, Store, Home, Layers, LogOut, LayoutDashboard, ShoppingBag, MessageCircle, Bell, ShieldCheck, Sun, Moon, UtensilsCrossed, Trophy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/context/CartContext';
import { useNotifications } from '@/context/NotificationContext';
import { useTheme } from '@/context/ThemeContext';
import CartDrawer from './CartDrawer';
import SupportModal from './SupportModal';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { getItemCount } = useCart();
  const { unreadCount, requestPermission, permission, markAllRead } = useNotifications();
  const { theme, toggleTheme } = useTheme();
  const [cartOpen, setCartOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isVendorOwner, setIsVendorOwner] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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
          .select('role, avatar_url, university_id, universities(abbreviation)')
          .eq('id', session.user.id)
          .single();
        if (userData) {
          setRole(userData.role);
          setUser((prev: any) => ({ 
            ...prev, 
            avatar_url: userData.avatar_url,
            university_id: userData.university_id,
            university: userData.universities
          }));
        }
        // Fallback: Check if they own a brand even if role isn't 'vendor'
        const { data: brand } = await supabase.from('brands').select('id, marketplace_type').eq('owner_id', session.user.id).single();
        if (brand) {
          setIsVendorOwner(true);
          setUser((prev: any) => ({ ...prev, brand }));
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
          .select('role, avatar_url, university_id, universities(abbreviation)')
          .eq('id', session.user.id)
          .single();
        if (userData) {
          setRole(userData.role);
          setUser((prev: any) => ({ 
            ...prev, 
            avatar_url: userData.avatar_url,
            university_id: userData.university_id,
            university: userData.universities
          }));
        }
        const { data: brand } = await supabase.from('brands').select('id, marketplace_type').eq('owner_id', session.user.id).single();
        setIsVendorOwner(!!brand);
        if (brand) setUser((prev: any) => ({ ...prev, brand }));
      } else {
        setUser(null);
        setRole(null);
        setIsVendorOwner(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      if (pathname.startsWith('/delicacies')) {
        router.push(`/delicacies?q=${encodeURIComponent(searchQuery.trim())}`);
      } else {
        router.push(`/explore?q=${encodeURIComponent(searchQuery.trim())}`);
      }
      setSearchQuery('');
    }
  };

  const navLinks = [
    { href: '/', label: 'Home', icon: <Home size={16} /> },
    { href: '/explore', label: 'Explore', icon: <Search size={16} /> },
    { href: '/vendors', label: 'Vendors', icon: <Store size={16} /> },
    { href: '/services', label: 'Services', icon: <Layers size={16} /> },
    { href: '/delicacies', label: 'Delicacies', icon: <UtensilsCrossed size={16} /> },
    { href: '/rankings', label: 'Leaderboard', icon: <Trophy size={16} /> },
  ];

  const dashboardLink = role === 'admin' ? '/admin' 
    : (role === 'vendor' || isVendorOwner) 
    ? (user?.brand?.marketplace_type === 'delicacies' ? '/dashboard/delicacies' : '/dashboard/vendor')
    : role === 'university_admin' ? '/university-admin' 
    : role === 'delivery' ? '/dashboard/delivery' 
    : '/dashboard/customer';

  return (
    <header className={styles.header}>
      <nav className={`container-wide ${styles.nav}`}>
        {/* Logo */}
        <Link href="/" className={styles.logo}>
          <img src="/logo.png" alt="Logo" className={styles.logoImg} />
        </Link>

        {/* Search Bar (Jumia Style - Center) */}
        <form className={styles.searchBar} onSubmit={handleSearch}>
          <Search size={18} className={styles.searchIcon} />
          <input 
            type="text" 
            placeholder="Search products, brands and services..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className={styles.searchBtn}>SEARCH</button>
        </form>

        {/* Actions (Right) */}
        <div className={styles.actions}>
          <button 
            className={styles.themeToggle} 
            onClick={toggleTheme} 
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>

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
                <Link href={dashboardLink} className={styles.actionLink} title="Account" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className={styles.universityLabel}>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', textAlign: 'right' }}>
                      {user.university?.abbreviation || (user.university_id === '00000000-0000-0000-0000-000000000001' ? 'ABUAD' : 'Global')}
                    </div>
                  </div>
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
                    <span>Universal Admin Panel</span>
                  </Link>
                )}
                {(role === 'university_admin' || role === 'admin') && (
                  <Link href="/university-admin" className={styles.moduleItem} style={{ borderLeft: '3px solid #3b82f6', background: 'rgba(59,130,246,0.05)' }}>
                    <ShieldCheck size={18} style={{ color: '#3b82f6' }} />
                    <span style={{ color: '#3b82f6', fontWeight: 600 }}>University Admin Dashboard</span>
                  </Link>
                )}
                {(role === 'vendor' || role === 'admin' || isVendorOwner) && (
                  <>
                    {(user?.brand?.marketplace_type === 'normal' || user?.brand?.marketplace_type === 'both' || !user?.brand?.marketplace_type) && (
                      <Link href="/dashboard/vendor" className={styles.moduleItem}>
                        <Store size={18} />
                        <span>Vendor Dashboard (Fashion)</span>
                      </Link>
                    )}
                    {(user?.brand?.marketplace_type === 'delicacies' || user?.brand?.marketplace_type === 'both') && (
                      <Link href="/dashboard/delicacies" className={styles.moduleItem} style={{ borderLeft: '3px solid var(--primary)', background: 'rgba(235,12,122,0.05)' }}>
                        <UtensilsCrossed size={18} style={{ color: 'var(--primary)' }} />
                        <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Chief Chef Dashboard</span>
                      </Link>
                    )}
                  </>
                )}
                {role === 'delivery' && (
                  <Link href="/dashboard/delivery" className={styles.moduleItem}>
                    <ShoppingBag size={18} />
                    <span>Agent Dashboard</span>
                  </Link>
                )}
                <button 
                  onClick={(e) => { e.stopPropagation(); setSupportOpen(true); setMenuOpen(false); }} 
                  className={styles.moduleItem}
                >
                  <MessageCircle size={18} />
                  <span>Help Center</span>
                </button>
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
      <SupportModal isOpen={supportOpen} onClose={() => setSupportOpen(false)} />

      {/* Category Quick Bar */}
      <div className={styles.categoryBar}>
        <div className={`container-wide ${styles.categoryInner}`}>
          <Link href="/delicacies" className={styles.catPill} style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#fff', border: 'none', fontWeight: 700 }}>
            🍔 Delicacies
          </Link>

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

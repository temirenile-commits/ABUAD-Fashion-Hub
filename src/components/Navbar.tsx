'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Search, ShoppingBag, Heart, User, Menu, X, Store, Home, Layers } from 'lucide-react';
import styles from './Navbar.module.css';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  const navLinks = [
    { href: '/', label: 'Home', icon: <Home size={16} /> },
    { href: '/explore', label: 'Explore', icon: <Search size={16} /> },
    { href: '/vendors', label: 'Vendors', icon: <Store size={16} /> },
    { href: '/services', label: 'Services', icon: <Layers size={16} /> },
  ];

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
          <Link href="/auth/login" className="btn btn-secondary btn-sm">
            <User size={15} /> Login
          </Link>
          <Link href="/auth/register" className="btn btn-primary btn-sm">
            Join Free
          </Link>
          <button
            className={`${styles.menuToggle}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

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
          <Link href="/auth/login" className="btn btn-ghost" onClick={() => setMenuOpen(false)}>
            Login
          </Link>
          <Link href="/auth/register" className="btn btn-primary" onClick={() => setMenuOpen(false)}>
            Join Free
          </Link>
        </div>
      )}
    </header>
  );
}

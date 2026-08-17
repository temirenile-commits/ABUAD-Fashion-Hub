'use client';

import { useState } from 'react';
import { Menu, X, Search, RefreshCw, ArrowLeft, ChevronRight } from 'lucide-react';
import styles from './ResponsiveAdminChrome.module.css';

type ResponsiveAdminItem = {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
  href?: string;
};

type ResponsiveAdminChromeProps = {
  title: string;
  subtitle?: string;
  items: ResponsiveAdminItem[];
  activeId: string;
  onSelect: (id: string) => void;
  search?: string;
  onSearchChange?: (value: string) => void;
  onRefresh?: () => void;
  onExit?: () => void;
  exitLabel?: string;
};

export default function ResponsiveAdminChrome({
  title,
  subtitle,
  items,
  activeId,
  onSelect,
  search = '',
  onSearchChange,
  onRefresh,
  onExit,
  exitLabel = 'Exit admin',
}: ResponsiveAdminChromeProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const select = (id: string, href?: string) => { if (href) window.location.href = href; else onSelect(id); close(); };

  return (
    <>
      <header className={styles.mobileHeader}>
        <button className={styles.iconButton} type="button" aria-label="Open admin navigation" onClick={() => setOpen(true)}><Menu size={21} /></button>
        <div className={styles.mobileTitle}><strong>{title}</strong>{subtitle && <span>{subtitle}</span>}</div>
        <div className={styles.headerActions}>
          {onRefresh && <button className={styles.iconButton} type="button" aria-label="Refresh admin data" onClick={onRefresh}><RefreshCw size={18} /></button>}
          {onExit && <button className={styles.iconButton} type="button" aria-label={exitLabel} onClick={onExit}><ArrowLeft size={18} /></button>}
        </div>
      </header>

      {onSearchChange && <div className={styles.mobileSearch}>
        <Search size={17} aria-hidden="true" />
        <input value={search} onChange={event => onSearchChange(event.target.value)} placeholder="Search users, vendors, orders..." aria-label="Search administration" />
      </div>}

      {open && <button type="button" aria-label="Close admin navigation" className={styles.scrim} onClick={close} />}
      <aside className={`${styles.drawer} ${open ? styles.drawerOpen : ''}`} aria-hidden={!open}>
        <div className={styles.drawerHeader}>
          <div><strong>MasterCart</strong><span>{subtitle || 'Administration'}</span></div>
          <button className={styles.iconButton} type="button" aria-label="Close admin navigation" onClick={close}><X size={20} /></button>
        </div>
        <nav className={styles.drawerNav} aria-label="Mobile administration navigation">
          {items.map(({ id, label, icon: Icon, badge, href }) => <button key={id} type="button" className={`${styles.navItem} ${activeId === id ? styles.navActive : ''}`} onClick={() => select(id, href)}>
            <Icon size={18} /><span>{label}</span>{badge ? <span className={styles.badge}>{badge}</span> : <ChevronRight size={15} className={styles.chevron} />}
          </button>)}
        </nav>
        {onExit && <button type="button" className={styles.exitButton} onClick={() => { onExit(); close(); }}><ArrowLeft size={17} />{exitLabel}</button>}
      </aside>
    </>
  );
}

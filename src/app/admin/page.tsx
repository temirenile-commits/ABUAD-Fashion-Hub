'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users, Store, ShoppingBag, TrendingUp, CheckCircle, XCircle,
  Search, RefreshCw, Trash2, Star, Eye, ShieldCheck, ShoppingCart, Loader2, CreditCard, AlertTriangle, Settings
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from './admin.module.css';

type Tab = 'overview' | 'vendors' | 'products' | 'users' | 'financials' | 'orders' | 'settings';

async function adminFetch(path: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  return fetch(path, {
    ...options,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token || ''}`,
      ...(options.headers || {})
    }
  });
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [search, setSearch] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<any>(null);

  const [stats, setStats] = useState({ userCount: 0, brandCount: 0, productCount: 0, totalRevenue: 0 });
  const [vendors, setVendors] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [platformSettings, setPlatformSettings] = useState<any>({});

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, vendorsRes, productsRes, usersRes, txRes, ordersRes, settingsRes] = await Promise.all([
        adminFetch('/api/admin?action=stats'),
        adminFetch('/api/admin?action=vendors'),
        adminFetch('/api/admin?action=products'),
        adminFetch('/api/admin?action=users'),
        adminFetch('/api/admin?action=transactions'),
        adminFetch('/api/admin?action=orders'),
        adminFetch('/api/admin?action=settings'),
      ]);

      const [statsData, vendorsData, productsData, usersData, txData, ordersData, settingsData] = await Promise.all([
        statsRes.json(), vendorsRes.json(), productsRes.json(),
        usersRes.json(), txRes.json(), ordersRes.json(), settingsRes.json(),
      ]);

      if (statsData.stats) setStats(statsData.stats);
      if (vendorsData.vendors) setVendors(vendorsData.vendors);
      if (productsData.products) setProducts(productsData.products);
      if (usersData.users) setUsers(usersData.users);
      if (txData.transactions) setTransactions(txData.transactions);
      if (ordersData.orders) setOrders(ordersData.orders);
      if (settingsData.settings) setPlatformSettings(settingsData.settings);
    } catch (e) {
      console.error('Admin fetch error:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const adminAction = async (action: string, payload: Record<string, any>) => {
    const key = action + (payload.brandId || payload.productId || payload.userId || '');
    setActionLoading(key);
    try {
      const res = await adminFetch('/api/admin', {
        method: 'POST',
        body: JSON.stringify({ action, ...payload })
      });
      const data = await res.json();
      if (data.success) {
        await fetchAll();
        if (selectedVendor && payload.brandId === selectedVendor.id) setSelectedVendor(null);
      } else {
        alert(data.error || 'Action failed');
      }
    } catch {
      alert('Network error');
    }
    setActionLoading('');
  };

  const filterBy = (items: any[], fields: string[]) => {
    if (!search.trim()) return items;
    return items.filter(item =>
      fields.some(f => String(item[f] || '').toLowerCase().includes(search.toLowerCase()))
    );
  };

  const pendingVendors = vendors.filter(v => v.verification_status === 'pending');

  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logo}>AF ADMIN</div>
          <p>Campus Marketplace Admin</p>
        </div>
        <nav className={styles.nav}>
          {([
            ['overview', 'Overview', TrendingUp],
            ['vendors', 'Vendors', Store],
            ['products', 'Catalog', ShoppingBag],
            ['users', 'Users', Users],
            ['orders', 'Orders', ShoppingCart],
            ['financials', 'Payouts', CreditCard],
            ['settings', 'Settings', Settings],
          ] as [Tab, string, any][]).map(([id, label, Icon]) => (
            <button
              key={id}
              className={`${styles.navItem} ${activeTab === id ? styles.navActive : ''}`}
              onClick={() => { setActiveTab(id); setSearch(''); }}
            >
              <Icon size={18} /> {label}
              {id === 'vendors' && pendingVendors.length > 0 && <span className={styles.badgeCount}>{pendingVendors.length}</span>}
            </button>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <Link href="/dashboard/vendor" className={styles.exitLink}>My Vendor Store</Link>
          <Link href="/" className={styles.exitLink}>← Public Site</Link>
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <h1>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h1>
          <div className={styles.headerActions}>
            <div className={styles.searchBar}>
              <Search size={16} />
              <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className="btn btn-ghost" onClick={fetchAll}><RefreshCw size={18} className={loading ? 'spin' : ''} /></button>
          </div>
        </header>

        {loading ? <div className={styles.loadingState}><Loader2 size={32} className="spin" /></div> : (
          <div className={styles.content}>
            {activeTab === 'overview' && (
              <div className={styles.statsGrid}>
                {[
                  { label: 'Users', val: stats.userCount, color: '#3b82f6', Icon: Users },
                  { label: 'Brands', val: stats.brandCount, color: '#10b981', Icon: Store },
                  { label: 'Products', val: stats.productCount, color: '#c9a14a', Icon: ShoppingBag },
                  { label: 'Revenue', val: `₦${stats.totalRevenue.toLocaleString()}`, color: '#eb0c7a', Icon: TrendingUp },
                ].map(({ label, val, color, Icon }) => (
                  <div className={styles.statCard} key={label}>
                    <div className={styles.statInfo}><p>{label}</p><h3>{val}</h3></div>
                    <div className={styles.statIcon} style={{ color }}><Icon size={22} /></div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'vendors' && (
              <div className={styles.sectionCard}>
                <table className={styles.table}>
                  <thead>
                    <tr><th>Brand</th><th>Academic Details</th><th>Tier</th><th>Status</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {filterBy(vendors, ['name', 'matric_number']).map(v => (
                      <tr key={v.id}>
                        <td>
                          <div className={styles.brandCell}>
                            {v.logo_url ? <img src={v.logo_url} alt="" className={styles.tableLogo} /> : <div className={styles.logoPlaceholder}>{v.name?.substring(0, 2).toUpperCase()}</div>}
                            <div><div>{v.name}</div><div className={styles.subText}>{v.users?.email}</div></div>
                          </div>
                        </td>
                        <td>
                          <div className={styles.academicInfo}>
                            <div>Matric: {v.matric_number || '—'}</div>
                            <div>Room: {v.room_number || '—'}</div>
                            <div>College: {v.college || '—'}</div>
                          </div>
                        </td>
                        <td><span className={`badge badge-${v.subscription_tier || 'free'}`} style={{ textTransform: 'uppercase', fontVariant: 'small-caps' }}>{v.subscription_tier || 'free'}</span></td>
                        <td><span className={`badge badge-${v.verification_status}`}>{v.verification_status}</span></td>
                        <td>
                          <div className={styles.actionRow} style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedVendor(v)} title="Review Details"><Eye size={14} /></button>
                            
                            {v.verification_status !== 'verified' && (
                              <button className="btn btn-primary btn-sm" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }} onClick={() => adminAction('approve_vendor', { brandId: v.id })}>Verify</button>
                            )}

                            <div style={{ display: 'flex', gap: '2px', background: 'rgba(255,255,255,0.05)', padding: '2px', borderRadius: '6px' }}>
                              {['quarter', 'half', 'full'].map(t => (
                                <button 
                                  key={t}
                                  className={`btn btn-sm ${v.subscription_tier === t ? 'btn-primary' : 'btn-ghost'}`}
                                  style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem', minWidth: '24px' }}
                                  onClick={() => adminAction('activate_plan', { brandId: v.id, tierId: t })}
                                  title={`Switch to ${t} power`}
                                >
                                  {t[0].toUpperCase()}
                                </button>
                              ))}
                            </div>

                            <div style={{ display: 'flex', gap: '2px', background: 'rgba(201, 161, 74, 0.05)', padding: '2px', borderRadius: '6px' }}>
                              {['rodeo', 'nitro', 'apex'].map(b => (
                                <button 
                                  key={b}
                                  className={`btn btn-sm ${v.boost_level === b ? 'btn-primary' : 'btn-ghost'}`}
                                  style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem', color: v.boost_level === b ? '#000' : 'var(--primary)' }}
                                  onClick={() => adminAction('activate_boost', { brandId: v.id, boostId: b })}
                                  title={`Activate ${b} boost`}
                                >
                                  {b === 'rodeo' ? 'R' : b === 'nitro' ? 'N' : 'A'}
                                </button>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'users' && (
              <div className={styles.sectionCard}>
                <table className={styles.table}>
                  <thead>
                    <tr><th>User</th><th>Email</th><th>Role</th><th>Joined</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {filterBy(users, ['name', 'email']).map(u => (
                      <tr key={u.id}>
                        <td>{u.name || '—'}</td>
                        <td>{u.email}</td>
                        <td>
                          <select 
                            className={`badge badge-${u.role}`}
                            value={u.role}
                            onChange={(e) => adminAction('update_user_role', { userId: u.id, newRole: e.target.value })}
                          >
                            <option value="customer">CUSTOMER</option>
                            <option value="vendor">VENDOR</option>
                            <option value="admin">ADMIN</option>
                          </select>
                        </td>
                        <td className={styles.subText}>{new Date(u.created_at).toLocaleDateString()}</td>
                        <td>
                          <div className={styles.actionRow}>
                            {u.role === 'vendor' && !vendors.find(v => v.owner_id === u.id) && (
                              <button className="btn btn-secondary btn-sm" onClick={() => adminAction('initialize_brand', { userId: u.id })} title="Create missing brand record">
                                Initialize Store
                              </button>
                            )}
                            {u.role !== 'admin' && <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => adminAction('delete_user', { userId: u.id })}><Trash2 size={14} /></button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {activeTab === 'settings' && (
              <div className={styles.sectionCard}>
                <h2>Platform Payment Rates</h2>
                <p className={styles.subText}>Adjust the official subscription and boost prices across the platform.</p>
                
                <div style={{ marginTop: '2rem' }}>
                  <h3>Subscription Tiers (monthly)</h3>
                  <div className={styles.settingsGrid}>
                    {platformSettings.subscription_rates?.map((tier: any, i: number) => (
                      <div key={tier.id} className={styles.settingsBox}>
                        <label>{tier.name}</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input 
                            type="number" 
                            value={tier.price} 
                            onChange={(e) => {
                              const updated = [...platformSettings.subscription_rates];
                              updated[i].price = Number(e.target.value);
                              setPlatformSettings({ ...platformSettings, subscription_rates: updated });
                            }}
                          />
                          <button className="btn btn-primary btn-sm" onClick={() => adminAction('update_settings', { key: 'subscription_rates', value: platformSettings.subscription_rates })}>Save</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: '3rem' }}>
                  <h3>Homepage Boost Rates</h3>
                  <div className={styles.settingsGrid}>
                    {platformSettings.boost_rates?.map((boost: any, i: number) => (
                      <div key={boost.id} className={styles.settingsBox}>
                        <label>{boost.name}</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input 
                            type="number" 
                            value={boost.price} 
                            onChange={(e) => {
                              const updated = [...platformSettings.boost_rates];
                              updated[i].price = Number(e.target.value);
                              setPlatformSettings({ ...platformSettings, boost_rates: updated });
                            }}
                          />
                          <button className="btn btn-primary btn-sm" onClick={() => adminAction('update_settings', { key: 'boost_rates', value: platformSettings.boost_rates })}>Save</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: '3rem' }}>
                  <h3>Brand Activation Fee</h3>
                  <div className={styles.settingsBox} style={{ maxWidth: '300px' }}>
                    <label>Registration Fee (₦)</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input 
                        type="number" 
                        value={platformSettings.activation_fee?.amount || 0} 
                        onChange={(e) => setPlatformSettings({ ...platformSettings, activation_fee: { amount: Number(e.target.value) } })}
                      />
                      <button className="btn btn-primary btn-sm" onClick={() => adminAction('update_settings', { key: 'activation_fee', value: platformSettings.activation_fee })}>Save</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {selectedVendor && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>Review Vendor: {selectedVendor.name}</h2>
              <button onClick={() => setSelectedVendor(null)}><XCircle size={24} /></button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.modalSection}>
                <h3>Academic Profile</h3>
                <p><strong>Matric No:</strong> {selectedVendor.matric_number}</p>
                <p><strong>Room No:</strong> {selectedVendor.room_number}</p>
                <p><strong>College:</strong> {selectedVendor.college}</p>
                <p><strong>Department:</strong> {selectedVendor.department}</p>
              </div>
              <div className={styles.modalSection}>
                <h3>Contact</h3>
                <p><strong>WhatsApp:</strong> {selectedVendor.whatsapp_number}</p>
                <p><strong>Email:</strong> {selectedVendor.users?.email}</p>
              </div>
              <div className={styles.modalSection}>
                <h3>Subscription Management</h3>
                <p>Current Tier: <strong style={{ color: 'var(--primary)' }}>{selectedVendor.subscription_tier || 'Free'}</strong></p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginTop: '1rem' }}>
                  {['quarter', 'half', 'full'].map(t => (
                    <button 
                      key={t}
                      className={`btn btn-sm ${selectedVendor.subscription_tier === t ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => adminAction('activate_plan', { brandId: selectedVendor.id, tierId: t })}
                      style={{ fontSize: '0.7rem' }}
                    >
                      {t === 'quarter' ? 'Quarter' : t === 'half' ? 'Half' : 'Full Power'}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.modalSection}>
                <h3>Admin Decision</h3>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button className="btn btn-primary" onClick={() => adminAction('approve_vendor', { brandId: selectedVendor.id })}>Approve & Grant Dashboard</button>
                  <button className="btn btn-ghost" style={{ color: '#ef4444' }} onClick={() => adminAction('reject_vendor', { brandId: selectedVendor.id })}>Reject</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

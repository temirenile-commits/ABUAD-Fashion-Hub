'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users, Store, ShoppingBag, TrendingUp, CheckCircle, XCircle,
  Search, RefreshCw, Trash2, Star, Eye, ShieldCheck, ShoppingCart, Loader2, CreditCard, AlertTriangle, Settings, Bell
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from './admin.module.css';

type Tab = 'overview' | 'vendors' | 'products' | 'users' | 'financials' | 'orders' | 'settings' | 'reviews' | 'notices';

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
  const [enlargedImg, setEnlargedImg] = useState<string | null>(null);
  const [notifForm, setNotifForm] = useState({ title: '', content: '', target: 'all', userId: '' });
  const [notifSending, setNotifSending] = useState(false);

  const [stats, setStats] = useState({ userCount: 0, brandCount: 0, productCount: 0, totalRevenue: 0 });
  const [vendors, setVendors] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [platformSettings, setPlatformSettings] = useState<any>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, vendorsRes, productsRes, usersRes, txRes, ordersRes, reviewsRes, settingsRes] = await Promise.all([
        adminFetch('/api/admin?action=stats'),
        adminFetch('/api/admin?action=vendors'),
        adminFetch('/api/admin?action=products'),
        adminFetch('/api/admin?action=users'),
        adminFetch('/api/admin?action=transactions'),
        adminFetch('/api/admin?action=orders'),
        adminFetch('/api/admin?action=reviews'),
        adminFetch('/api/admin?action=settings'),
      ]);

      const [statsData, vendorsData, productsData, usersData, txData, ordersData, reviewsData, settingsData] = await Promise.all([
        statsRes.json(), vendorsRes.json(), productsRes.json(),
        usersRes.json(), txRes.json(), ordersRes.json(), reviewsRes.json(), settingsRes.json(),
      ]);

      if (statsData.stats) setStats(statsData.stats);
      if (vendorsData.vendors) setVendors(vendorsData.vendors);
      if (productsData.products) setProducts(productsData.products);
      if (usersData.users) setUsers(usersData.users);
      if (txData.transactions) setTransactions(txData.transactions);
      if (ordersData.orders) setOrders(ordersData.orders);
      if (reviewsData.reviews) setReviews(reviewsData.reviews);
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
            ['reviews', 'Reviews ⭐', Star],
            ['notices', 'Notices 📣', Bell],
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
                    <tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {filterBy(users, ['name', 'email']).map(u => (
                      <tr key={u.id}>
                        <td>{u.name || '—'}</td>
                        <td>{u.email}</td>
                        <td><span className={`badge badge-${u.role}`}>{u.role}</span></td>
                        <td><span className={`badge badge-${u.status || 'active'}`}>{u.status || 'active'}</span></td>
                        <td>{new Date(u.created_at).toLocaleDateString()}</td>
                        <td>
                          <div className={styles.actionRow}>
                            <select 
                              className="input input-sm" 
                              style={{ width: '120px', fontSize: '0.75rem' }}
                              value={u.role}
                              onChange={(e) => adminAction('update_user_role', { userId: u.id, newRole: e.target.value })}
                              disabled={actionLoading === 'update_user_role' + u.id}
                            >
                              <option value="customer">Customer</option>
                              <option value="vendor">Vendor</option>
                              <option value="delivery">Delivery</option>
                              <option value="admin">Admin</option>
                            </select>

                            {u.role !== 'admin' && (
                              <button 
                                className="btn btn-ghost btn-sm" 
                                style={{ color: '#ef4444' }} 
                                onClick={() => adminAction('delete_user', { userId: u.id })}
                                title="Delete User Permanently"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {activeTab === 'products' && (
              <div className={styles.sectionCard}>
                <table className={styles.table}>
                  <thead>
                    <tr><th>Product</th><th>Brand</th><th>Price</th><th>Stock</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                     {filterBy(products, ['title']).map(p => (
                      <tr key={p.id}>
                        <td>
                          <div className={styles.brandCell}>
                            {(p.image_url || p.media_urls?.[0]) ? (
                              <img
                                src={p.image_url || p.media_urls[0]}
                                alt=""
                                className={styles.tableLogo}
                                style={{ cursor: 'zoom-in' }}
                                onClick={() => setEnlargedImg(p.image_url || p.media_urls[0])}
                                title="Click to enlarge"
                              />
                            ) : <div className={styles.logoPlaceholder}><ShoppingBag size={14}/></div>}
                            <div>{p.title}</div>
                          </div>
                        </td>
                        <td>{p.brands?.name || 'Unknown'}</td>
                        <td>₦{Number(p.price).toLocaleString()}</td>
                        <td>{p.stock_count === -1 ? '∞' : p.stock_count}</td>
                        <td>
                          <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => confirm('Delete this product?') && adminAction('delete_product', { productId: p.id })}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'orders' && (
              <div className={styles.sectionCard}>
                <table className={styles.table}>
                  <thead>
                    <tr><th>Order ID</th><th>Customer</th><th>Brand</th><th>Amount</th><th>Status</th><th>Date</th></tr>
                  </thead>
                  <tbody>
                    {filterBy(orders, ['id', 'status']).map(o => (
                      <tr key={o.id}>
                        <td className={styles.subText}>#{o.id.slice(0, 8)}</td>
                        <td>
                          <div>{o.users?.name || 'Customer'}</div>
                          <div className={styles.subText}>{o.users?.email}</div>
                        </td>
                        <td>{o.brands?.name}</td>
                        <td>₦{Number(o.total_amount).toLocaleString()}</td>
                        <td><span className={`badge badge-${o.status}`}>{o.status}</span></td>
                        <td className={styles.subText}>{new Date(o.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'financials' && (
              <div className={styles.sectionCard}>
                <table className={styles.table}>
                  <thead>
                    <tr><th>Type</th><th>Reference</th><th>Brand</th><th>Amount</th><th>Status</th><th>Date</th></tr>
                  </thead>
                  <tbody>
                    {filterBy(transactions, ['type', 'description']).map(tx => (
                      <tr key={tx.id}>
                        <td><span className={`badge badge-${tx.type}`}>{tx.type.replace('_', ' ')}</span></td>
                        <td className={styles.subText}>{tx.description}</td>
                        <td>{tx.brands?.name || 'System'}</td>
                        <td style={{ color: tx.type === 'payment_in' ? '#10b981' : '#f59e0b' }}>
                          {tx.type === 'payment_in' ? '+' : '-'}₦{Number(tx.amount).toLocaleString()}
                        </td>
                        <td>{tx.status}</td>
                        <td className={styles.subText}>{new Date(tx.created_at).toLocaleDateString()}</td>
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

            {activeTab === 'reviews' && (
              <div className={styles.sectionCard}>
                <table className={styles.table}>
                  <thead>
                    <tr><th>User</th><th>Product</th><th>Rating</th><th>Comment</th><th>Date</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {filterBy(reviews, ['comment', 'users.name']).map(r => (
                      <tr key={r.id}>
                        <td>
                          <div className={styles.subText}>{r.users?.name || 'Anonymous'}</div>
                          <div className={styles.subText} style={{ fontSize: '0.7rem' }}>{r.users?.email}</div>
                        </td>
                        <td>{r.products?.title || 'Unknown Product'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '2px' }}>
                            {new Array(5).fill(0).map((_, i) => (
                              <Star key={i} size={12} fill={i < r.rating ? "#c9a14a" : "none"} stroke={i < r.rating ? "#c9a14a" : "#ccc"} />
                            ))}
                          </div>
                        </td>
                        <td><div style={{ maxWidth: '250px', fontSize: '0.85rem' }}>{r.comment}</div></td>
                        <td className={styles.subText}>{new Date(r.created_at).toLocaleDateString()}</td>
                        <td>
                          <button 
                            className="btn btn-ghost btn-sm" 
                            style={{ color: '#ef4444' }} 
                            onClick={() => { if(confirm('Delete this review?')) adminAction('delete_review', { reviewId: r.id }) }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'notices' && (
              <div className={styles.sectionCard}>
                <h2>Send Platform Notice</h2>
                <p className={styles.subText}>Send a real-time push notification to all users or a specific user. It will appear on their device immediately.</p>

                <div style={{ maxWidth: 560, marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>Notification Title</label>
                    <input
                      value={notifForm.title}
                      onChange={e => setNotifForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="e.g. 🔥 Flash Sale Alert!"
                      style={{ width: '100%', background: 'var(--bg-300)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem', color: '#fff' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>Message</label>
                    <textarea
                      value={notifForm.content}
                      onChange={e => setNotifForm(f => ({ ...f, content: e.target.value }))}
                      rows={4}
                      placeholder="Type your message here..."
                      style={{ width: '100%', background: 'var(--bg-300)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem', color: '#fff', resize: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>Send To</label>
                    <select
                      value={notifForm.target}
                      onChange={e => setNotifForm(f => ({ ...f, target: e.target.value }))}
                      style={{ background: 'var(--bg-300)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem', color: '#fff', width: '100%' }}
                    >
                      <option value="all">📢 All Users (Broadcast)</option>
                      <option value="specific">👤 Specific User</option>
                    </select>
                  </div>
                  {notifForm.target === 'specific' && (
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>User ID</label>
                      <input
                        value={notifForm.userId}
                        onChange={e => setNotifForm(f => ({ ...f, userId: e.target.value }))}
                        placeholder="Paste the target user's UUID"
                        style={{ width: '100%', background: 'var(--bg-300)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem', color: '#fff', fontFamily: 'monospace', fontSize: '0.8rem' }}
                      />
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-400)', marginTop: '0.3rem' }}>Copy user ID from the Users tab above.</p>
                    </div>
                  )}
                  <button
                    className="btn btn-primary"
                    disabled={notifSending || !notifForm.title || !notifForm.content}
                    onClick={async () => {
                      setNotifSending(true);
                      try {
                        const res = await adminFetch('/api/admin', {
                          method: 'POST',
                          body: JSON.stringify({
                            action: 'send_notification',
                            title: notifForm.title,
                            content: notifForm.content,
                            target: notifForm.target,
                            userId: notifForm.userId,
                          }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          alert(`✅ Notification sent to ${data.sent} user(s)!`);
                          setNotifForm({ title: '', content: '', target: 'all', userId: '' });
                        } else {
                          alert(data.error || 'Failed to send');
                        }
                      } catch { alert('Network error'); }
                      setNotifSending(false);
                    }}
                  >
                    {notifSending ? 'Sending...' : '📣 Send Notification'}
                  </button>
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

      {/* Image Lightbox */}
      {enlargedImg && (
        <div
          onClick={() => setEnlargedImg(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out',
          }}
        >
          <img
            src={enlargedImg}
            alt="Product"
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12, boxShadow: '0 0 60px rgba(0,0,0,0.8)' }}
          />
          <button
            onClick={() => setEnlargedImg(null)}
            style={{ position: 'absolute', top: 24, right: 24, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', padding: 10, cursor: 'pointer', color: '#fff' }}
          >
            <XCircle size={28} />
          </button>
        </div>
      )}
    </div>
  );
}

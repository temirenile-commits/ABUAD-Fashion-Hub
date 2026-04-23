'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users, Store, ShoppingBag, TrendingUp, CheckCircle, XCircle,
  Search, Settings, CreditCard, Loader2, RefreshCw, Trash2, Star,
  AlertTriangle, Eye, ShieldCheck, ShieldX, LogOut, X, FileText,
  MapPin, Phone, Mail, ExternalLink
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from './admin.module.css';

type Tab = 'overview' | 'vendors' | 'products' | 'users' | 'financials' | 'orders';

// Helper to call the admin API securely with the user's session token
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

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, vendorsRes, productsRes, usersRes, txRes, ordersRes] = await Promise.all([
        adminFetch('/api/admin?action=stats'),
        adminFetch('/api/admin?action=vendors'),
        adminFetch('/api/admin?action=products'),
        adminFetch('/api/admin?action=users'),
        adminFetch('/api/admin?action=transactions'),
        adminFetch('/api/admin?action=orders'),
      ]);

      const [statsData, vendorsData, productsData, usersData, txData, ordersData] = await Promise.all([
        statsRes.json(), vendorsRes.json(), productsRes.json(),
        usersRes.json(), txRes.json(), ordersRes.json(),
      ]);

      if (statsData.stats) setStats(statsData.stats);
      if (vendorsData.vendors) setVendors(vendorsData.vendors);
      if (productsData.products) setProducts(productsData.products);
      if (usersData.users) setUsers(usersData.users);
      if (txData.transactions) setTransactions(txData.transactions);
      if (ordersData.orders) setOrders(ordersData.orders);
    } catch (e) {
      console.error('Admin fetch error:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const adminAction = async (action: string, payload: Record<string, any>) => {
    setActionLoading(action + (payload.brandId || payload.productId || payload.userId || ''));
    try {
      const res = await adminFetch('/api/admin', {
        method: 'POST',
        body: JSON.stringify({ action, ...payload })
      });
      const data = await res.json();
      if (data.success) {
        await fetchAll(); // Refresh all data after action
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
  const isActionLoading = (key: string) => actionLoading === key;

  return (
    <div className={styles.container}>
      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logo}>AF ADMIN</div>
          <p>Super-Admin Control</p>
        </div>

        <nav className={styles.nav}>
          {([
            ['overview', 'Overview', TrendingUp],
            ['vendors', 'Vendors', Store],
            ['products', 'Catalog', ShoppingBag],
            ['users', 'Users', Users],
            ['financials', 'Financials', CreditCard],
            ['orders', 'Orders', ShoppingBag],
          ] as [Tab, string, any][]).map(([id, label, Icon]) => (
            <button
              key={id}
              className={`${styles.navItem} ${activeTab === id ? styles.navActive : ''}`}
              onClick={() => { setActiveTab(id); setSearch(''); }}
            >
              <Icon size={18} /> {label}
              {id === 'vendors' && pendingVendors.length > 0 && (
                <span style={{ marginLeft: 'auto', background: '#ef4444', color: '#fff', borderRadius: '999px', padding: '0 6px', fontSize: '0.7rem', fontWeight: 700 }}>
                  {pendingVendors.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <Link href="/" className={styles.exitLink}>← Back to Marketplace</Link>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className={styles.main}>
        <header className={styles.header}>
          <h1>
            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            {activeTab === 'vendors' && pendingVendors.length > 0 && (
              <span style={{ fontSize: '0.75rem', background: '#ef4444', color: '#fff', padding: '0.2rem 0.6rem', borderRadius: '999px', marginLeft: '1rem', fontFamily: 'var(--font-sans)' }}>
                {pendingVendors.length} Pending
              </span>
            )}
          </h1>
          <div className={styles.headerActions}>
            <div className={styles.searchBar}>
              <Search size={16} />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button className="btn btn-ghost btn-icon" onClick={fetchAll} title="Refresh data">
              <RefreshCw size={18} className={loading ? 'spin' : ''} />
            </button>
          </div>
        </header>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem', color: 'var(--text-400)' }}>
            <Loader2 size={32} className="spin" />
          </div>
        ) : (
          <>
            {/* ══ OVERVIEW TAB ══ */}
            {activeTab === 'overview' && (
              <div className={styles.content}>
                <div className={styles.statsGrid}>
                  {[
                    { label: 'Total Users', val: stats.userCount, color: '#3b82f6', Icon: Users },
                    { label: 'Active Brands', val: stats.brandCount, color: '#10b981', Icon: Store },
                    { label: 'Products Listed', val: stats.productCount, color: '#c9a14a', Icon: ShoppingBag },
                    { label: 'Platform Revenue', val: `₦${Number(stats.totalRevenue || 0).toLocaleString()}`, color: '#eb0c7a', Icon: TrendingUp },
                  ].map(({ label, val, color, Icon }) => (
                    <div className={styles.statCard} key={label}>
                      <div className={styles.statInfo}><p>{label}</p><h3>{val}</h3></div>
                      <div className={styles.statIcon} style={{ color }}><Icon size={22} /></div>
                    </div>
                  ))}
                </div>

                <div className={styles.sectionsGrid}>
                  <section className={styles.sectionCard}>
                    <h3>
                      🔔 Pending Verifications
                      <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>{pendingVendors.length} awaiting</span>
                    </h3>
                    <div className={styles.pList}>
                      {pendingVendors.slice(0, 5).map(v => (
                        <div key={v.id} className={styles.pItem}>
                          <div className={styles.pInfo}>
                            <h4>{v.name}</h4>
                            <p>{v.users?.email} · {new Date(v.created_at).toLocaleDateString()}</p>
                          </div>
                          <div className={styles.pActions}>
                            <button
                              className="btn btn-primary btn-sm"
                              disabled={!!actionLoading}
                              onClick={() => adminAction('approve_vendor', { brandId: v.id })}
                            >
                              {isActionLoading('approve_vendor' + v.id) ? <Loader2 size={14} className="spin" /> : <CheckCircle size={14} />} Approve
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ color: '#ef4444' }}
                              disabled={!!actionLoading}
                              onClick={() => adminAction('reject_vendor', { brandId: v.id })}
                            >
                              <XCircle size={14} /> Reject
                            </button>
                          </div>
                        </div>
                      ))}
                      {pendingVendors.length === 0 && <p className={styles.emptyText}>✅ No pending applications.</p>}
                    </div>
                  </section>

                  <section className={styles.sectionCard}>
                    <h3>System Health</h3>
                    <div className={styles.healthStats}>
                      <div className={styles.healthItem}><CheckCircle size={16} color="#10b981" /> Database Connected</div>
                      <div className={styles.healthItem}><CheckCircle size={16} color="#10b981" /> Supabase Storage: Online</div>
                      <div className={styles.healthItem}><CheckCircle size={16} color="#10b981" /> Paystack: Live Mode</div>
                      <div className={styles.healthItem}><CheckCircle size={16} color="#10b981" /> Admin API: Secured</div>
                    </div>
                    <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-400)', marginBottom: '0.5rem' }}>RECENT ACTIVITY</p>
                      <p style={{ fontSize: '0.85rem' }}>{orders.slice(0, 3).map(o => (
                        <span key={o.id} style={{ display: 'block', marginBottom: '0.35rem' }}>
                          Order #{o.id.substring(0, 8)} — <strong>₦{Number(o.total_amount || 0).toLocaleString()}</strong>
                        </span>
                      ))}</p>
                    </div>
                  </section>
                </div>
              </div>
            )}

            {/* ══ VENDORS TAB ══ */}
            {activeTab === 'vendors' && (
              <div className={styles.content}>
                <div className={styles.sectionCard}>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Brand</th>
                          <th>Owner Email</th>
                          <th>WhatsApp</th>
                          <th>Status</th>
                          <th>Documents</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filterBy(vendors, ['name', 'whatsapp_number']).map(v => (
                          <tr key={v.id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                {v.logo_url ? (
                                  <img src={v.logo_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                                ) : (
                                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-300)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700 }}>
                                    {v.name?.substring(0, 2).toUpperCase()}
                                  </div>
                                )}
                                <div>
                                  <div style={{ fontWeight: 600 }}>{v.name}</div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-400)' }}>{v.category}</div>
                                </div>
                              </div>
                            </td>
                             <td style={{ fontSize: '0.85rem' }}>
                               <div style={{ fontWeight: 500 }}>{v.users?.name || 'Unknown'}</div>
                               <div style={{ fontSize: '0.75rem', color: 'var(--text-400)' }}>{v.users?.email || '—'}</div>
                             </td>
                            <td style={{ fontSize: '0.85rem' }}>{v.whatsapp_number || '—'}</td>
                            <td>
                              <span className={`badge ${
                                v.verification_status === 'verified' ? 'badge-success' :
                                v.verification_status === 'approved' ? 'badge-gold' :
                                v.verification_status === 'pending' ? 'badge-neutral' :
                                'badge-error'
                              }`}>
                                {v.verification_status || 'pending'}
                              </span>
                            </td>
                            <td>
                              {(v.verification_documents || []).length > 0 ? (
                                <div style={{ display: 'flex', gap: '0.4rem' }}>
                                  {v.verification_documents.map((url: string, i: number) => (
                                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                                      <Eye size={14} /> Doc {i + 1}
                                    </a>
                                  ))}
                                </div>
                              ) : <span style={{ color: 'var(--text-400)', fontSize: '0.8rem' }}>None uploaded</span>}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                <button 
                                  className="btn btn-ghost btn-sm" 
                                  onClick={() => setSelectedVendor(v)}
                                  title="Review Details"
                                >
                                  <Eye size={14} /> Review
                                </button>
                                {v.verification_status === 'pending' && (
                                  <>
                                    <button className="btn btn-primary btn-sm" disabled={!!actionLoading} onClick={() => adminAction('approve_vendor', { brandId: v.id })}>
                                      <ShieldCheck size={14} /> Approve
                                    </button>
                                  </>
                                )}
                                {v.verification_status === 'approved' && (
                                  <button className="btn btn-primary btn-sm" disabled={!!actionLoading} onClick={() => adminAction('mark_verified', { brandId: v.id })}>
                                    <CheckCircle size={14} /> Mark Verified
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ══ PRODUCTS TAB ══ */}
            {activeTab === 'products' && (
              <div className={styles.content}>
                <div className={styles.sectionCard}>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr><th>Product</th><th>Brand</th><th>Price</th><th>Stock</th><th>Featured</th><th>Actions</th></tr>
                      </thead>
                      <tbody>
                        {filterBy(products, ['title']).map(p => (
                          <tr key={p.id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                {p.media_urls?.[0] ? (
                                  <img src={p.media_urls[0]} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }} />
                                ) : (
                                  <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--bg-300)' }} />
                                )}
                                {p.title}
                              </div>
                            </td>
                            <td>{p.brands?.name}</td>
                            <td>₦{Number(p.price).toLocaleString()}</td>
                            <td>{p.stock_count ?? '—'}</td>
                            <td>
                              <button
                                className={`btn btn-ghost btn-sm`}
                                style={{ color: p.is_featured ? '#f59e0b' : 'var(--text-400)' }}
                                onClick={() => adminAction('feature_product', { productId: p.id, featured: !p.is_featured })}
                              >
                                <Star size={14} fill={p.is_featured ? '#f59e0b' : 'none'} /> {p.is_featured ? 'Featured' : 'Feature'}
                              </button>
                            </td>
                            <td>
                              <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => {
                                if (confirm(`Delete "${p.title}"?`)) adminAction('delete_product', { productId: p.id });
                              }}>
                                <Trash2 size={14} /> Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ══ USERS TAB ══ */}
            {activeTab === 'users' && (
              <div className={styles.content}>
                <div className={styles.sectionCard}>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr><th>Name</th><th>Email</th><th>Role</th><th>Confirmed</th><th>Last Login</th><th>Joined</th><th>Actions</th></tr>
                      </thead>
                      <tbody>
                        {filterBy(users, ['name', 'email', 'role']).map(u => (
                          <tr key={u.id}>
                            <td style={{ fontWeight: 600 }}>{u.name || '—'}</td>
                            <td>{u.email}</td>
                             <td>
                               <select 
                                 className={`badge ${u.role === 'admin' ? 'badge-gold' : u.role === 'vendor' ? 'badge-success' : 'badge-neutral'}`}
                                 style={{ border: 'none', appearance: 'none', cursor: 'pointer', padding: '0.2rem 1.5rem 0.2rem 0.5rem', backgroundPosition: 'right 0.5rem center' }}
                                 value={u.role}
                                 onChange={(e) => {
                                   const newRole = e.target.value;
                                   if (confirm(`Change role for ${u.email} to ${newRole}?`)) {
                                     adminAction('update_user_role', { userId: u.id, newRole });
                                   }
                                 }}
                               >
                                 <option value="customer">CUSTOMER</option>
                                 <option value="vendor">VENDOR</option>
                                 <option value="admin">ADMIN</option>
                               </select>
                             </td>
                            <td>
                              {u.confirmed ? <CheckCircle size={16} color="#10b981" /> : <AlertTriangle size={16} color="#f59e0b" />}
                            </td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--text-400)' }}>
                              {u.last_sign_in ? new Date(u.last_sign_in).toLocaleDateString() : 'Never'}
                            </td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--text-400)' }}>
                              {new Date(u.created_at).toLocaleDateString()}
                            </td>
                            <td>
                              {u.role !== 'admin' && (
                                <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => {
                                  if (confirm(`Delete account for ${u.email}? This is irreversible.`)) adminAction('delete_user', { userId: u.id });
                                }}>
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                        {users.length === 0 && (
                          <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-400)' }}>No users found.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ══ FINANCIALS TAB ══ */}
            {activeTab === 'financials' && (
              <div className={styles.content}>
                <div className={styles.sectionCard}>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr><th>Type</th><th>Amount</th><th>Status</th><th>Brand</th><th>User</th><th>Date</th></tr>
                      </thead>
                      <tbody>
                        {filterBy(transactions, ['type', 'status']).map(t => (
                          <tr key={t.id}>
                            <td><span style={{ textTransform: 'capitalize' }}>{String(t.type || '').replace(/_/g, ' ')}</span></td>
                            <td style={{ fontWeight: 700, color: t.type === 'payout' ? '#ef4444' : '#10b981' }}>
                              {t.type === 'payout' ? '-' : '+'}₦{Number(t.amount || 0).toLocaleString()}
                            </td>
                            <td><span className={`badge ${t.status === 'success' ? 'badge-success' : 'badge-neutral'}`}>{t.status}</span></td>
                            <td>{t.brands?.name || '—'}</td>
                            <td>{t.users?.name || t.users?.email || '—'}</td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--text-400)' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                        {transactions.length === 0 && (
                          <tr><td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-400)' }}>No transactions yet.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ══ ORDERS TAB ══ */}
            {activeTab === 'orders' && (
              <div className={styles.content}>
                <div className={styles.sectionCard}>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr><th>Order ID</th><th>Product</th><th>Brand</th><th>Customer</th><th>Amount</th><th>Status</th><th>Date</th></tr>
                      </thead>
                      <tbody>
                        {filterBy(orders, ['status']).map(o => (
                          <tr key={o.id}>
                            <td style={{ fontSize: '0.75rem', color: 'var(--text-400)' }}>{o.id.substring(0, 10)}...</td>
                            <td>{o.products?.title || '—'}</td>
                            <td>{o.brands?.name || '—'}</td>
                            <td>{o.users?.name || o.users?.email || '—'}</td>
                            <td style={{ fontWeight: 700 }}>₦{Number(o.total_amount || 0).toLocaleString()}</td>
                            <td>
                              <span className={`badge ${
                                o.status === 'confirmed' || o.status === 'delivered' ? 'badge-success' :
                                o.status === 'paid' ? 'badge-gold' : 'badge-neutral'
                              }`}>{o.status}</span>
                            </td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--text-400)' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                        {orders.length === 0 && (
                          <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-400)' }}>No orders yet.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Vendor Details Modal ── */}
      {selectedVendor && (
        <div 
          className={styles.modalOverlay}
          onClick={(e) => e.target === e.currentTarget && setSelectedVendor(null)}
        >
          <div className={styles.modalContent}>
            <header className={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {selectedVendor.logo_url ? (
                  <img src={selectedVendor.logo_url} alt="" className={styles.modalLogo} />
                ) : (
                  <div className={styles.modalLogoPlaceholder}>
                    {selectedVendor.name?.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <h2>{selectedVendor.name}</h2>
                  <p className={styles.categoryBadge}>{selectedVendor.category}</p>
                </div>
              </div>
              <button 
                className={styles.closeBtn}
                onClick={() => setSelectedVendor(null)}
              >
                <X size={20} />
              </button>
            </header>

            <div className={styles.modalBody}>
              <section className={styles.modalSection}>
                <h3><FileText size={16} /> Brand Story</h3>
                <p className={styles.descriptionText}>
                  {selectedVendor.description || 'No description provided.'}
                </p>
              </section>

              <div className={styles.detailsGrid}>
                <section className={styles.modalSection}>
                  <h3><Mail size={16} /> Contact Details</h3>
                  <div className={styles.contactList}>
                    <div className={styles.contactItem}>
                      <strong>Owner:</strong> <span>{selectedVendor.users?.name || 'Unknown'}</span>
                    </div>
                    <div className={styles.contactItem}>
                      <Mail size={14} /> <span>{selectedVendor.users?.email || 'N/A'}</span>
                    </div>
                    <div className={styles.contactItem}>
                      <Phone size={14} /> <span>{selectedVendor.whatsapp_number || 'N/A'}</span>
                    </div>
                  </div>
                </section>

                <section className={styles.modalSection}>
                  <h3><ShieldCheck size={16} /> Application Status</h3>
                  <span className={`badge ${
                    selectedVendor.verification_status === 'verified' ? 'badge-success' :
                    selectedVendor.verification_status === 'approved' ? 'badge-gold' :
                    selectedVendor.verification_status === 'pending' ? 'badge-neutral' :
                    'badge-error'
                  }`} style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}>
                    {selectedVendor.verification_status?.toUpperCase() || 'PENDING'}
                  </span>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-400)', marginTop: '0.5rem' }}>
                    Joined: {new Date(selectedVendor.created_at).toLocaleDateString()}
                  </p>
                </section>
              </div>

              <section className={styles.modalSection}>
                <h3><ShieldCheck size={16} /> Verification Documents</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-300)', marginBottom: '1rem' }}>
                  Please carefully review the identity and business documents below.
                </p>
                <div className={styles.docGrid}>
                  <div className={styles.docCard}>
                    <div className={styles.docInfo}>
                      <FileText size={20} strokeWidth={1.5} />
                      <div>
                        <strong>Student / Faculty ID</strong>
                        <p>{selectedVendor.student_id_url ? 'Document Provided' : 'Not Uploaded'}</p>
                      </div>
                    </div>
                    {selectedVendor.student_id_url && (
                      <div className={styles.docActions}>
                        <a href={selectedVendor.student_id_url} target="_blank" rel="noreferrer" className={styles.viewDocBtn}>
                          <Eye size={14} /> Open Document
                        </a>
                      </div>
                    )}
                  </div>

                  <div className={styles.docCard}>
                    <div className={styles.docInfo}>
                      <ShieldCheck size={20} strokeWidth={1.5} />
                      <div>
                        <strong>Business Proof / Address</strong>
                        <p>{selectedVendor.business_proof_url ? 'Document Provided' : 'Not Uploaded'}</p>
                      </div>
                    </div>
                    {selectedVendor.business_proof_url && (
                      <div className={styles.docActions}>
                         <a href={selectedVendor.business_proof_url} target="_blank" rel="noreferrer" className={styles.viewDocBtn}>
                          <Eye size={14} /> Open Document
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>

            <footer className={styles.modalFooter}>
              {selectedVendor.verification_status === 'pending' && (
                <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
                  <button 
                    className="btn btn-primary" 
                    style={{ flex: 1 }}
                    onClick={() => {
                      adminAction('approve_vendor', { brandId: selectedVendor.id });
                      setSelectedVendor(null);
                    }}
                  >
                    <ShieldCheck size={18} /> Approve Application
                  </button>
                  <button 
                    className="btn btn-ghost" 
                    style={{ flex: 1, color: '#ef4444', border: '1px solid #ef4444' }}
                    onClick={() => {
                      const reason = prompt('Reason for rejection?');
                      if (reason !== null) {
                        adminAction('reject_vendor', { brandId: selectedVendor.id, reason });
                        setSelectedVendor(null);
                      }
                    }}
                  >
                    <ShieldX size={18} /> Reject
                  </button>
                </div>
              )}
              {selectedVendor.verification_status === 'approved' && (
                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%' }}
                  onClick={() => {
                    adminAction('mark_verified', { brandId: selectedVendor.id });
                    setSelectedVendor(null);
                  }}
                >
                  <CheckCircle size={18} /> Mark as Verified (Fee Paid)
                </button>
              )}
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

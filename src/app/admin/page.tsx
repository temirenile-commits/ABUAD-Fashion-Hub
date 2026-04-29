'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users, Store, ShoppingBag, TrendingUp, CheckCircle, XCircle,
  Search, RefreshCw, Trash2, Star, Eye, ShieldCheck, ShoppingCart, Loader2, CreditCard, AlertTriangle, Settings, Bell,
  BarChart3, PieChart, Activity, ExternalLink, MapPin, Tag
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from './admin.module.css';
import TradingChart from '@/components/TradingChart';

type Tab = 'overview' | 'vendors' | 'products' | 'users' | 'financials' | 'orders' | 'settings' | 'reviews' | 'notices' | 'market' | 'delivery_agents';

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
  
  const [confirmPayoutModal, setConfirmPayoutModal] = useState<any>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [transferRef, setTransferRef] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);

  const [stats, setStats] = useState({ userCount: 0, brandCount: 0, productCount: 0, totalRevenue: 0, totalSubsidies: 0 });
  const [vendors, setVendors] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'paid' | 'pending' | 'cancelled'>('all');
  const [reviews, setReviews] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [platformSettings, setPlatformSettings] = useState<any>(null);
  const [marketData, setMarketData] = useState<any[]>([]);
  const [deliveryAgents, setDeliveryAgents] = useState<any[]>([]);
  const [promoCodes, setPromoCodes] = useState<any[]>([]);
  const [promoForm, setPromoForm] = useState({ code: '', type: 'percentage', value: 10, max_uses: 100, product_id: '' });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, vendorsRes, productsRes, usersRes, txRes, ordersRes, reviewsRes, payoutsRes, settingsRes, marketRes, deliveryAgentsResRaw, promoResRaw] = await Promise.all([
        adminFetch('/api/admin?action=stats'),
        adminFetch('/api/admin?action=vendors'),
        adminFetch('/api/admin?action=products'),
        adminFetch('/api/admin?action=users'),
        adminFetch('/api/admin?action=transactions'),
        adminFetch('/api/admin?action=orders'),
        adminFetch('/api/admin?action=reviews'),
        adminFetch('/api/admin?action=payouts'),
        adminFetch('/api/admin?action=settings'),
        adminFetch('/api/admin?action=market_analytics'),
        adminFetch('/api/admin?action=delivery_agents'),
        adminFetch('/api/admin?action=promo_codes'),
      ]);

      const [statsData, vendorsData, productsData, usersData, txData, ordersData, reviewsData, payoutsData, settingsData, marketDataRes, deliveryAgentsData, promoData] = await Promise.all([
        statsRes.json(), vendorsRes.json(), productsRes.json(),
        usersRes.json(), txRes.json(), ordersRes.json(), reviewsRes.json(), payoutsRes.json(), settingsRes.json(), marketRes.json(), deliveryAgentsResRaw.json(), promoResRaw.json()
      ]);
      
      if (marketDataRes.chartData) setMarketData(marketDataRes.chartData);

      if (statsData.stats) setStats(statsData.stats);
      if (vendorsData.vendors) setVendors(vendorsData.vendors);
      if (productsData.products) setProducts(productsData.products);
      if (usersData.users) setUsers(usersData.users);
      if (txData.transactions) setTransactions(txData.transactions);
      if (ordersData.orders) setOrders(ordersData.orders);
      if (reviewsData.reviews) setReviews(reviewsData.reviews);
      if (payoutsData.payouts) setPayouts(payoutsData.payouts);
      if (settingsData.settings) setPlatformSettings(settingsData.settings);
      if (deliveryAgentsData.agents) setDeliveryAgents(deliveryAgentsData.agents);
      if (promoData.promoCodes) setPromoCodes(promoData.promoCodes);
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

  const handleConfirmPayout = async () => {
    if (!proofFile || !transferRef) return alert('Please attach proof and enter reference');
    setUploadingProof(true);
    try {
      const fileExt = proofFile.name.split('.').pop();
      const filePath = `payouts/${confirmPayoutModal.id}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('payout_proofs').upload(filePath, proofFile, { upsert: true });
      if (uploadError) throw uploadError;
      
      const { data } = supabase.storage.from('payout_proofs').getPublicUrl(filePath);
      await adminAction('confirm_payout', { requestId: confirmPayoutModal.id, proofUrl: data.publicUrl, reference: transferRef });
      setConfirmPayoutModal(null);
      setProofFile(null);
      setTransferRef('');
    } catch (e: any) {
      alert(e.message || 'Upload failed');
    }
    setUploadingProof(false);
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
            ['promotions', 'Promotions 📢', Star],
            ['settings', 'Settings', Settings],
            ['reviews', 'Reviews ⭐', Star],
            ['notices', 'Notices 📣', Bell],
            ['market', 'Market 📉', BarChart3],
            ['delivery_agents', 'Fleet 🚚', Activity],
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
                  { label: 'Subsidies', val: `₦${(stats.totalSubsidies || 0).toLocaleString()}`, color: '#f59e0b', Icon: Tag },
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
                            <button className="btn btn-ghost btn-sm" style={{ color: '#f59e0b' }} onClick={() => { if(confirm('Reset this vendor to free mode?')) adminAction('reset_vendor_to_free', { brandId: v.id }) }} title="Reset to Free Mode"><RefreshCw size={14} /></button>
                            <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => { if(confirm('Suspend this vendor?')) adminAction('suspend_vendor', { brandId: v.id }) }} title="Suspend Vendor"><Trash2 size={14} /></button>
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
                            <button
                               className="btn btn-ghost btn-sm"
                               onClick={() => {
                                 const p = prompt('Enter permissions JSON:', JSON.stringify(u.admin_permissions || {}));
                                 if (p) adminAction('update_admin_permissions', { userId: u.id, permissions: JSON.parse(p) });
                               }}
                               title="Edit Permissions"
                             >
                               <ShieldCheck size={14} />
                             </button>

                             {u.role !== 'admin' && (
                               <button 
                                 className="btn btn-ghost btn-sm" 
                                 style={{ color: '#ef4444' }} 
                                 onClick={() => { if(confirm('Permanently delete this user? This cannot be undone.')) adminAction('delete_user', { userId: u.id }) }}
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

                <div style={{ marginTop: '3rem' }}>
                  <h3>Promo Codes (Subsidized by Admin)</h3>
                  <p className={styles.subText}>Create discount codes that apply to all products or specific ones. The discount amount will be deducted from your admin commission.</p>
                  
                  <div className={styles.settingsGrid} style={{ marginTop: '1.5rem' }}>
                    <div className={styles.settingsBox}>
                      <label>New Promo Code</label>
                      <input value={promoForm.code} onChange={e => setPromoForm({ ...promoForm, code: e.target.value })} placeholder="e.g. WELCOME50" className="input mb-2" />
                      <div className="flex gap-2 mb-2">
                        <select className="input" value={promoForm.type} onChange={e => setPromoForm({ ...promoForm, type: e.target.value })}>
                           <option value="percentage">Percentage (%)</option>
                           <option value="fixed">Fixed Amount (₦)</option>
                        </select>
                        <input type="number" className="input" value={promoForm.value} onChange={e => setPromoForm({ ...promoForm, value: Number(e.target.value) })} />
                      </div>
                      <label>Max Uses</label>
                      <input type="number" className="input mb-2" value={promoForm.max_uses} onChange={e => setPromoForm({ ...promoForm, max_uses: Number(e.target.value) })} />
                      <label>Product ID (Optional)</label>
                      <input value={promoForm.product_id} onChange={e => setPromoForm({ ...promoForm, product_id: e.target.value })} placeholder="Paste Product UUID" className="input mb-2" />
                      
                      <button className="btn btn-primary w-full" onClick={() => adminAction('create_promo_code', promoForm)}>Create Code</button>
                    </div>

                    {promoCodes.map(pc => (
                      <div key={pc.id} className={styles.settingsBox}>
                        <div className="flex justify-between items-start">
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                               <Tag size={12} /> {pc.code}
                            </div>
                            <div className={styles.subText} style={{ fontSize: '0.8rem' }}>{pc.type === 'percentage' ? `${pc.value}% off` : `₦${pc.value} off`}</div>
                            <div style={{ fontSize: '0.7rem', marginTop: '4px' }}>Uses: <strong>{pc.current_uses || 0}</strong> / {pc.max_uses}</div>
                            {pc.products && <div style={{ fontSize: '0.7rem', color: 'var(--primary)' }}>Target: {pc.products.title.substring(0, 20)}...</div>}
                          </div>
                          <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444', padding: '4px' }} onClick={() => confirm('Delete this code?') && adminAction('delete_promo_code', { codeId: pc.id })}><Trash2 size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'delivery_agents' && (
              <div className={styles.sectionCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                  <div>
                    <h2>Delivery Fleet</h2>
                    <p className={styles.subText}>Monitor riders, track their locations, and manage payout balances.</p>
                  </div>
                </div>

                <table className={styles.table}>
                  <thead>
                    <tr><th>Rider</th><th>Status</th><th>Performance</th><th>Earnings</th><th>Location</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {filterBy(deliveryAgents, ['name', 'email']).map(agent => (
                      <tr key={agent.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{agent.name}</div>
                          <div className={styles.subText} style={{ fontSize: '0.75rem' }}>{agent.email}</div>
                        </td>
                        <td>
                          <span className={`badge ${agent.is_active ? 'badge-verified' : 'badge-pending'}`}>
                              {agent.is_active ? 'Online' : 'Offline'}
                          </span>
                        </td>
                        <td>
                          <div className={styles.subText}>Orders: {agent.completed_orders_count || 0}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--primary)' }}>₦{Number(agent.wallet_balance || 0).toLocaleString()}</div>
                          <div className={styles.subText} style={{ fontSize: '0.7rem' }}>Pending payout</div>
                        </td>
                        <td>
                          {agent.current_lat ? (
                            <button 
                              className="btn btn-ghost btn-sm" 
                              onClick={() => window.open(`https://www.google.com/maps?q=${agent.current_lat},${agent.current_long}`, '_blank')}
                              style={{ color: 'var(--primary)', padding: 0 }}
                            >
                              <MapPin size={14} /> View on Map
                            </button>
                          ) : <span className={styles.subText}>No Signal</span>}
                        </td>
                        <td>
                          <div className={styles.actionRow}>
                            <button 
                              className="btn btn-ghost btn-sm"
                              onClick={() => adminAction('reset_agent_balance', { userId: agent.id })}
                              title="Reset Balance"
                            >
                              <RefreshCw size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'orders' && (
              <div className={styles.sectionCard}>
                <div className={styles.filterBar}>
                   {(['all', 'paid', 'pending', 'cancelled'] as const).map(f => (
                     <button 
                       key={f}
                       className={`${styles.filterBtn} ${orderStatusFilter === f ? styles.filterActive : ''}`}
                       onClick={() => setOrderStatusFilter(f)}
                     >
                       {f.toUpperCase()}
                     </button>
                   ))}
                 </div>
                <table className={styles.table}>
                  <thead>
                    <tr><th>Order ID</th><th>Customer</th><th>Brand</th><th>Amount</th><th>Status</th><th>Date</th></tr>
                  </thead>
                  <tbody>
                    {filterBy(orders.filter(o => orderStatusFilter === 'all' || o.status === orderStatusFilter), ['id', 'status']).map(o => (
                      <tr key={o.id}>
                        <td className={styles.subText}>#{o.id.slice(0, 8)}</td>
                        <td>
                          <div>{o.users?.name || 'Customer'}</div>
                          <div className={styles.subText}>{o.users?.email}</div>
                        </td>
                        <td>{o.brands?.name}</td>
                        <td>₦{Number(o.total_amount).toLocaleString()}</td>
                        <td>
                          {o.status === 'pending' && o.expires_at && new Date(o.expires_at) < new Date() ? (
                            <span className="badge badge-cancelled" style={{ background: '#ef4444' }}>EXPIRED</span>
                          ) : (
                            <span className={`badge badge-${o.status}`}>{o.status}</span>
                          )}
                        </td>
                        <td className={styles.subText}>{new Date(o.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'financials' && (
               <div className={styles.sectionCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <div>
                      <h2>Payout Requests</h2>
                      <p className={styles.subText}>Manage withdrawals from vendors and delivery agents.</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className={styles.subText}>Admin Promo Subsidies</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b' }}>₦{(stats.totalSubsidies || 0).toLocaleString()}</div>
                    </div>
                  </div>
                 <table className={styles.table} style={{ marginTop: '1rem' }}>
                   <thead>
                     <tr><th>ID</th><th>User</th><th>Role</th><th>Amount</th><th>Status</th><th>Date</th><th>Actions</th></tr>
                   </thead>
                   <tbody>
                     {filterBy(payouts, ['role', 'status', 'users.name']).map(req => (
                       <tr key={req.id}>
                         <td className={styles.subText}>#{req.id.slice(0, 8)}</td>
                         <td>
                           <div>{req.users?.name || 'Unknown'}</div>
                           <div className={styles.subText}>{req.users?.email}</div>
                         </td>
                         <td><span className={`badge badge-${req.role}`}>{req.role}</span></td>
                         <td style={{ color: '#f59e0b', fontWeight: 'bold' }}>₦{Number(req.amount_requested).toLocaleString()}</td>
                         <td><span className={`badge badge-${req.status}`}>{req.status}</span></td>
                         <td className={styles.subText}>{new Date(req.created_at).toLocaleDateString()}</td>
                         <td>
                           {req.status === 'pending' || req.status === 'processing' ? (
                             <button className="btn btn-primary btn-sm" onClick={() => setConfirmPayoutModal(req)}>Confirm</button>
                           ) : req.proof_url ? (
                             <a href={req.proof_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">View Proof</a>
                           ) : '—'}
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             )}

             {activeTab === 'settings' && (
               <div className={styles.sectionCard}>
                 <h2>Platform Configuration</h2>
                 <div style={{ marginTop: '2rem' }}>
                   <h3>Subscription Tiers (monthly)</h3>
                   <div className={styles.settingsGrid}>
                     {platformSettings?.subscription_rates?.map((tier: any, i: number) => (
                       <div key={tier.id} className={styles.settingsBox}>
                         <label>{tier.name} Price (₦)</label>
                         <input 
                           type="number" 
                           value={tier.price} 
                           onChange={(e) => {
                             const updated = [...platformSettings.subscription_rates];
                             updated[i].price = Number(e.target.value);
                             setPlatformSettings({ ...platformSettings, subscription_rates: updated });
                           }}
                           className="input mb-2"
                         />
                         <label>Features (comma separated)</label>
                         <textarea
                           rows={2}
                           className="input mb-2"
                           placeholder="e.g. Campus Billboard, 10 Products"
                           value={(tier.features || []).join(', ')}
                           onChange={(e) => {
                             const updated = [...platformSettings.subscription_rates];
                             updated[i].features = e.target.value.split(',').map((f: string) => f.trim()).filter(Boolean);
                             setPlatformSettings({ ...platformSettings, subscription_rates: updated });
                           }}
                         />
                         <button className="btn btn-primary btn-sm mt-2" onClick={() => adminAction('update_settings', { key: 'subscription_rates', value: platformSettings.subscription_rates })}>Save</button>
                       </div>
                     ))}
                   </div>
                 </div>
                 <div style={{ marginTop: '3rem' }}>
                   <h3>Free Tier Configuration</h3>
                   <div className={styles.settingsBox} style={{ maxWidth: '300px' }}>
                      <label>Max Products (Free)</label>
                      <input 
                        type="number" 
                        value={platformSettings?.free_tier_config?.max_products || 10} 
                        onChange={(e) => setPlatformSettings({ ...platformSettings, free_tier_config: { ...platformSettings.free_tier_config, max_products: Number(e.target.value) } })}
                      />
                      <button className="btn btn-primary btn-sm mt-2" onClick={() => adminAction('update_settings', { key: 'free_tier_config', value: platformSettings.free_tier_config })}>Save</button>
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
                           <div>{r.users?.name || 'Anonymous'}</div>
                           <div className={styles.subText}>{r.users?.email}</div>
                         </td>
                         <td>{r.products?.title || 'Unknown Product'}</td>
                         <td>{r.rating} ⭐</td>
                         <td>{r.comment}</td>
                         <td>{new Date(r.created_at).toLocaleDateString()}</td>
                         <td>
                           <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => adminAction('delete_review', { reviewId: r.id })}>
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
                <div style={{ maxWidth: 560, marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <input value={notifForm.title} onChange={e => setNotifForm(f => ({ ...f, title: e.target.value }))} placeholder="Notification Title" className="input" />
                  <textarea value={notifForm.content} onChange={e => setNotifForm(f => ({ ...f, content: e.target.value }))} rows={4} placeholder="Message body..." className="input" style={{ resize: 'vertical' }} />
                  <select 
                    value={notifForm.target} 
                    onChange={e => setNotifForm(f => ({ ...f, target: e.target.value }))}
                    className="input"
                  >
                    <option value="all">📢 All Users (Broadcast)</option>
                    <option value="all_vendors">🏪 All Vendors</option>
                    <option value="all_delivery">🚚 All Delivery Agents</option>
                    <option value="all_customers">👤 All Customers</option>
                    <option value="specific">🎯 Specific User ID</option>
                  </select>
                  {notifForm.target === 'specific' && (
                    <input 
                      value={notifForm.userId} 
                      onChange={e => setNotifForm(f => ({ ...f, userId: e.target.value }))} 
                      placeholder="Paste User UUID" 
                      className="input"
                    />
                  )}
                  <button
                    className="btn btn-primary"
                    disabled={notifSending}
                    onClick={async () => {
                      setNotifSending(true);
                      try {
                        const res = await adminFetch('/api/admin', {
                          method: 'POST',
                          body: JSON.stringify({ action: 'send_notification', ...notifForm }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          alert('Notification sent successfully!');
                          setNotifForm({ title: '', content: '', target: 'all', userId: '' });
                        } else {
                          alert(data.error || 'Failed to send notification');
                        }
                      } catch (e) {
                        alert('Connection error');
                      }
                      setNotifSending(false);
                    }}
                  >
                    {notifSending ? 'Sending...' : '📣 Send Notification'}
                  </button>
                </div>
              </div>
            )}
            
            {activeTab === 'market' && (
              <div className={styles.marketGrid}>
                <div className={styles.marketHeader}>
                  <div>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Activity color="var(--primary)" size={24} /> 
                      Market Oversight & Competition
                    </h2>
                    <p className={styles.subText}>Monitor live sales velocity, product price effects, and vendor performance trends.</p>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => adminAction('recalculate_ratings', {})}>
                    <RefreshCw size={14} /> Recalculate All Vendor Ratings
                  </button>
                </div>

                <div className={styles.chartsGrid}>
                  <TradingChart 
                    data={marketData} 
                    title="Live Sales Velocity (Naira / Day)" 
                    color="#10b981" 
                    height={350}
                  />
                  <div className={styles.marketInsights}>
                    <h3>Market Trends</h3>
                    <div className={styles.insightCard}>
                      <div className={styles.insightValue}>₦{(marketData.reduce((acc, curr) => acc + curr.value, 0) / (marketData.length || 1)).toFixed(2)}</div>
                      <div className={styles.insightLabel}>Avg. Daily Revenue</div>
                    </div>
                    <div className={styles.insightCard}>
                      <div className={styles.insightValue}>{vendors.length}</div>
                      <div className={styles.insightLabel}>Active Competing Brands</div>
                    </div>
                    <div className={styles.insightCard}>
                      <div className={styles.insightValue}>₦{(products.reduce((acc, curr) => acc + Number(curr.price), 0) / (products.length || 1)).toFixed(2)}</div>
                      <div className={styles.insightLabel}>Avg. Market Price Point</div>
                    </div>
                  </div>
                </div>

                <div className={styles.sectionCard} style={{ marginTop: '2rem' }}>
                  <h3>Competition Heatmap</h3>
                  <table className={styles.table}>
                    <thead>
                      <tr><th>Brand</th><th>Category</th><th>Avg. Price</th><th>Sales</th><th>Growth</th></tr>
                    </thead>
                    <tbody>
                      {vendors.slice(0, 5).map(v => (
                        <tr key={v.id}>
                          <td>{v.name}</td>
                          <td>Clothing</td>
                          <td>₦{Number(v.avg_price || 0).toLocaleString()}</td>
                          <td>{v.total_sales || 0}</td>
                          <td style={{ color: '#10b981' }}>+12.5%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
              {selectedVendor.verification_type === 'business' ? (
                <div className={styles.modalSection}>
                  <h3>Business Profile</h3>
                  <p><strong>Business Name:</strong> {selectedVendor.business_name || '—'}</p>
                  <p><strong>Registration No (CAC):</strong> {selectedVendor.business_registration_number || '—'}</p>
                  <p><strong>Address:</strong> {selectedVendor.business_address || '—'}</p>
                </div>
              ) : (
                <div className={styles.modalSection}>
                  <h3>Academic Profile</h3>
                  <p><strong>Matric No:</strong> {selectedVendor.matric_number || '—'}</p>
                  <p><strong>Room No:</strong> {selectedVendor.room_number || '—'}</p>
                  <p><strong>College:</strong> {selectedVendor.college || '—'}</p>
                  <p><strong>Department:</strong> {selectedVendor.department || '—'}</p>
                </div>
              )}
              <div className={styles.modalSection}>
                <h3>Bank Details for Payouts</h3>
                <p><strong>Bank Name:</strong> {selectedVendor.bank_name || '—'}</p>
                <p><strong>Account Name:</strong> {selectedVendor.bank_account_name || '—'}</p>
                <p><strong>Account Number:</strong> <span style={{ fontFamily: 'monospace' }}>{selectedVendor.bank_account_number || '—'}</span></p>
              </div>
              <div className={styles.modalSection}>
                <h3>Contact</h3>
                <p><strong>WhatsApp:</strong> {selectedVendor.whatsapp_number}</p>
                <p><strong>Email:</strong> {selectedVendor.users?.email}</p>
              </div>
              <div className={styles.modalSection}>
                <h3>Listing Credits</h3>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <p style={{ margin: 0 }}>Remaining: <strong style={{ color: 'var(--primary)' }}>{selectedVendor.free_listings_count || 0}</strong></p>
                  <input 
                    type="number" 
                    className="input-sm" 
                    defaultValue={selectedVendor.free_listings_count || 0}
                    style={{ width: '80px' }}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val !== selectedVendor.free_listings_count) {
                        adminAction('update_vendor_credits', { brandId: selectedVendor.id, credits: val });
                      }
                    }}
                  />
                  <span className={styles.subText}>(Auto-saves on blur)</span>
                </div>
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
                <h3>Delivery System Control</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                  <div>
                    <label className={styles.subText} style={{ display: 'block', marginBottom: '0.3rem' }}>Delivery Scope</label>
                    <select 
                      className="input-sm" 
                      style={{ width: '100%', background: 'var(--bg-200)', border: '1px solid var(--border)', borderRadius: '4px', padding: '0.3rem', color: '#fff' }}
                      defaultValue={selectedVendor.delivery_scope || 'in-school'}
                      onChange={(e) => adminAction('update_delivery_config', { brandId: selectedVendor.id, scope: e.target.value })}
                    >
                      <option value="in-school">In-School (Campus)</option>
                      <option value="out-school">Out-School (Off-Campus)</option>
                    </select>
                  </div>
                  <div>
                    <label className={styles.subText} style={{ display: 'block', marginBottom: '0.3rem' }}>Assigned System</label>
                    <select 
                      className="input-sm" 
                      style={{ width: '100%', background: 'var(--bg-200)', border: '1px solid var(--border)', borderRadius: '4px', padding: '0.3rem', color: '#fff' }}
                      defaultValue={selectedVendor.assigned_delivery_system || 'platform'}
                      onChange={(e) => adminAction('update_delivery_config', { brandId: selectedVendor.id, system: e.target.value })}
                    >
                      <option value="platform">Platform Managed</option>
                      <option value="vendor">Vendor Managed</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className={styles.modalSection}>
                <h3>Admin Decision</h3>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button className="btn btn-primary" onClick={() => adminAction('approve_vendor', { brandId: selectedVendor.id })}>Approve & Grant Dashboard</button>
                  <button className="btn btn-ghost" style={{ color: '#ef4444' }} onClick={() => adminAction('reject_vendor', { brandId: selectedVendor.id })}>Reject</button>
                </div>
              </div>
              <div className={styles.modalSection}>
                <h3>Emergency Management</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1rem' }}>
                  <button 
                    className="btn btn-ghost btn-sm" 
                    style={{ color: '#ef4444', border: '1px solid #ef4444' }}
                    onClick={() => { if(confirm('Reset this vendor to Free Tier?')) adminAction('reset_vendor_to_free', { brandId: selectedVendor.id }) }}
                  >
                    <RefreshCw size={14} /> Reset to Free Tier
                  </button>
                  <button 
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      const url = `/store/${selectedVendor.id}`;
                      window.open(url, '_blank');
                    }}
                  >
                    <ExternalLink size={14} /> View Live Store
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmPayoutModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>Confirm Transfer</h2>
              <button onClick={() => setConfirmPayoutModal(null)}><XCircle size={24} /></button>
            </div>
            <div className={styles.modalBody}>
              <div style={{ padding: '1rem', background: 'var(--bg-300)', borderRadius: '8px', marginBottom: '1.5rem' }}>
                <p>Transfer <strong>₦{Number(confirmPayoutModal.amount_requested).toLocaleString()}</strong> to:</p>
                <p><strong>{confirmPayoutModal.bank_details?.accountName}</strong></p>
                <p><strong>{confirmPayoutModal.bank_details?.bankName}</strong> - {confirmPayoutModal.bank_details?.accountNumber}</p>
              </div>

              <div className="form-group">
                <label className="form-label">Transfer Reference ID</label>
                <input 
                  className="form-input" 
                  placeholder="e.g. TRF-123456789" 
                  value={transferRef} 
                  onChange={e => setTransferRef(e.target.value)} 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Upload Payment Receipt</label>
                <input 
                  type="file" 
                  accept="image/*,.pdf"
                  className="form-input" 
                  style={{ padding: '0.5rem' }}
                  onChange={e => setProofFile(e.target.files?.[0] || null)}
                />
              </div>

              <button 
                className="btn btn-primary" 
                style={{ width: '100%', marginTop: '1rem' }}
                onClick={handleConfirmPayout}
                disabled={uploadingProof || !proofFile || !transferRef}
              >
                {uploadingProof ? 'Uploading & Confirming...' : 'Upload Proof & Complete Payout'}
              </button>
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

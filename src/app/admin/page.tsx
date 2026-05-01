'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Users, Store, ShoppingBag, TrendingUp, CheckCircle, XCircle,
  Search, RefreshCw, Trash2, Star, Eye, ShieldCheck, ShoppingCart, Loader2, CreditCard, AlertTriangle, Settings, Bell,
  BarChart3, PieChart, Activity, ExternalLink, MapPin, Tag, ArrowLeft
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from './admin.module.css';
import TradingChart from '@/components/TradingChart';
import { useToast } from '@/context/ToastContext';

type Tab = 'overview' | 'universities' | 'vendors' | 'products' | 'users' | 'financials' | 'orders' | 'settings' | 'reviews' | 'notices' | 'market' | 'delivery_agents' | 'promotions';

async function adminFetch(path: string, options: RequestInit = {}) {
  return fetch(path, {
    ...options,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-secret': 'abuad-admin-super-secret-2024',
      ...(options.headers || {}),
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
  const [notifForm, setNotifForm] = useState({ title: '', content: '', target: 'all', userId: '', universityId: '' });
  const [notifSending, setNotifSending] = useState(false);
  
  const [confirmPayoutModal, setConfirmPayoutModal] = useState<any>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [transferRef, setTransferRef] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);

  const [stats, setStats] = useState({ userCount: 0, brandCount: 0, productCount: 0, totalRevenue: 0, totalSubsidies: 0, totalProductViews: 0, totalProfileViews: 0 });
  const [error, setError] = useState<string | null>(null);
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
  const [universities, setUniversities] = useState<any[]>([]);
  const [uniForm, setUniForm] = useState({ name: '', location: '', abbreviation: '' });
  const [uniCreating, setUniCreating] = useState(false);
  const [promoForm, setPromoForm] = useState({ code: '', type: 'percentage', value: 10, max_uses: 100, product_id: '' });
  
  const [adminSearch, setAdminSearch] = useState('');
  const [universityAdmins, setUniversityAdmins] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState('');
  
  const [selectedUniId, setSelectedUniId] = useState<string | null>(null);
  const [uniUsers, setUniUsers] = useState<any[]>([]);
  const [uniTeams, setUniTeams] = useState<any[]>([]);
  const [uniLoading, setUniLoading] = useState(false);
  
  const { addToast } = useToast();
  const fetchedRef = useRef(false);

  const safeJson = async (res: Response) => {
    try { return await res.json(); } catch { return {}; }
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Step 1: Fire all requests simultaneously
      const keys = ['stats','vendors','products','users','transactions','orders','reviews','payouts','settings','market_analytics','delivery_agents','promo_codes', 'universities_list'] as const;
      const fetchResults = await Promise.allSettled(
        keys.map(k => adminFetch(`/api/admin?action=${k}`))
      );

      // Step 2: Immediately parse all response bodies before streams close
      const jsonResults = await Promise.allSettled(
        fetchResults.map(r => {
          if (r.status === 'fulfilled' && r.value.ok) return r.value.json();
          if (r.status === 'fulfilled' && r.value.status === 401) return Promise.resolve({ __401: true });
          return Promise.resolve({});
        })
      );

      // Add university specific fetches
      const uniExtras = await Promise.all([
        adminFetch('/api/admin?action=university_admins'),
        adminFetch('/api/admin?action=university_teams')
      ]);
      const uniJson = await Promise.all(uniExtras.map(r => r.json()));

      const getData = (i: number) => jsonResults[i].status === 'fulfilled' ? (jsonResults[i] as any).value : {};

      // Check auth failure
      if (jsonResults.some(r => r.status === 'fulfilled' && (r as any).value?.__401)) {
        setError('Unauthorized: You do not have admin permissions or your session has expired.');
        setLoading(false);
        return;
      }

      const statsD = getData(0);
      const vendorsD = getData(1);
      const productsD = getData(2);
      const usersD = getData(3);
      const txD = getData(4);
      const ordersD = getData(5);
      const reviewsD = getData(6);
      const payoutsD = getData(7);
      const settingsD = getData(8);
      const marketD = getData(9);
      const agentsD = getData(10);
      const promosD = getData(11);
      const unisD = getData(12);

      setStats(prev => statsD.stats || prev);
      setVendors(vendorsD.vendors || []);
      setProducts(productsD.products || []);
      setUsers(usersD.users || []);
      setTransactions(txD.transactions || []);
      setOrders(ordersD.orders || []);
      setReviews(reviewsD.reviews || []);
      setPayouts(payoutsD.payouts || []);
      setPlatformSettings(settingsD.settings || null);
      setMarketData(marketD.chartData || []);
      setDeliveryAgents(agentsD.agents || []);
      setPromoCodes(promosD.promoCodes || []);
      setUniversities(unisD.universities || []);
      
      setUniversityAdmins(uniJson[0].admins || []);
      setTeams(uniJson[1].teams || []);

    } catch (e: any) {
      console.error('Admin fetch error:', e);
      setError('Connection error: Could not reach the administration server.');
    }
    setLoading(false);
  }, []);

  const [uniStats, setUniStats] = useState<any>(null);

  const fetchUniData = async (uniId: string) => {
    setUniLoading(true);
    setUniUsers([]); // Clear to avoid mix-up
    setUniTeams([]);
    setUniStats(null);
    try {
      const [uRes, tRes, sRes] = await Promise.all([
        adminFetch(`/api/admin?action=university_users&uniId=${uniId}`),
        adminFetch(`/api/admin?action=university_teams&uniId=${uniId}`),
        adminFetch(`/api/admin?action=stats&uniId=${uniId}`)
      ]);
      const [uData, tData, sData] = await Promise.all([uRes.json(), tRes.json(), sRes.json()]);
      
      // Safety filter: ensure no super admin appears in campus lists
      setUniUsers((uData.users || []).filter((u: any) => u.role !== 'admin'));
      setUniTeams(tData.teams || []);
      setUniStats(sData.stats || null);
    } catch { addToast('Failed to load university details', 'error'); }
    setUniLoading(false);
  };

  useEffect(() => { 
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchAll(); 
  }, [fetchAll]);

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
        addToast('Action completed successfully!', 'success');
      } else {
        addToast(data.error || 'Action failed', 'error');
      }
    } catch {
      addToast('Network error', 'error');
    }
    setActionLoading('');
  };

  const handleConfirmPayout = async () => {
    if (!proofFile || !transferRef) return addToast('Please attach proof and enter reference', 'error');
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
      addToast('Payout confirmed successfully!', 'success');
    } catch (e: any) {
      addToast(e.message || 'Upload failed', 'error');
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
          <div className={styles.logo}>MASTER CART ADMIN</div>
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
            ['promotions', 'Promotions ', Star],
            ['settings', 'Settings', Settings],
            ['reviews', 'Reviews ', Star],
            ['notices', 'Notices ', Bell],
            ['market', 'Market ', BarChart3],
            ['delivery_agents', 'Fleet ', Activity],
            ['universities', 'Universities', MapPin],
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h1>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h1>
            {!loading && !error && (
              <span className="badge badge-verified" style={{ fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Activity size={10} /> ADMIN LIVE
              </span>
            )}
          </div>
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
            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', padding: '1rem', borderRadius: '8px', color: '#b91c1c', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <AlertTriangle size={20} />
                <div>
                  <div style={{ fontWeight: 700 }}>System Error</div>
                  <div style={{ fontSize: '0.9rem' }}>{error}</div>
                </div>
              </div>
            )}
            {activeTab === 'overview' && (
              <div className={styles.statsGrid}>
                {[
                  { label: 'Users', val: stats.userCount, color: '#3b82f6', Icon: Users },
                  { label: 'Brands', val: stats.brandCount, color: '#10b981', Icon: Store },
                  { label: 'Products', val: stats.productCount, color: '#c9a14a', Icon: ShoppingBag },
                  { label: 'Revenue', val: `₦${stats.totalRevenue.toLocaleString()}`, color: '#eb0c7a', Icon: TrendingUp },
                  { label: 'Subsidies', val: `₦${(stats.totalSubsidies || 0).toLocaleString()}`, color: '#f59e0b', Icon: Tag },
                  { label: 'Product Views', val: (stats.totalProductViews || 0).toLocaleString(), color: '#8b5cf6', Icon: Eye },
                  { label: 'Profile Visits', val: (stats.totalProfileViews || 0).toLocaleString(), color: '#ec4899', Icon: Users },
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
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%', border: '1px solid var(--border)', borderRadius: '8px' }}><table className={styles.table}>
                  <thead>
                    <tr><th>Brand</th><th>University</th><th>Academic Details</th><th>Tier</th><th>Status</th><th>Actions</th></tr>
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
                          {v.universities ? (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span className="badge badge-primary" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', width: 'fit-content' }}>🎓 {v.universities.abbreviation}</span>
                              <span className={styles.subText} style={{ fontSize: '0.65rem' }}>{v.universities.name}</span>
                            </div>
                          ) : (
                            <span className={styles.subText}>General Marketplace</span>
                          )}
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
                </table></div>
              </div>
            )}

            {activeTab === 'users' && (
              <div className={styles.sectionCard}>
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%', border: '1px solid var(--border)', borderRadius: '8px' }}><table className={styles.table}>
                  <thead>
                    <tr><th>User</th><th>Role & Permissions</th><th>Status</th><th>Joined</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {filterBy(users, ['name', 'email']).map(u => (
                      <tr key={u.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{u.name || '—'}</div>
                          <div className={styles.subText}>{u.email}</div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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
                               <option value="sub_admin">Sub-Admin</option>
                             </select>
                             
                             {u.role === 'sub_admin' && (
                               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                                 {[
                                   { id: 'payouts', label: '💰', title: 'Payouts' },
                                   { id: 'customer_service', label: '🎧', title: 'Support' },
                                   { id: 'delivery', label: '🚚', title: 'Fleet' },
                                   { id: 'promotions', label: '📢', title: 'Adverts' },
                                   { id: 'orders', label: '📦', title: 'Orders' },
                                   { id: 'verification', label: '🛡️', title: 'Verify' },
                                   { id: 'reviews', label: '⭐', title: 'Reviews' }
                                 ].map(p => (
                                   <button 
                                     key={p.id}
                                     title={p.title}
                                     className={`btn btn-sm ${(u.admin_permissions || []).includes(p.id) ? 'btn-primary' : 'btn-ghost'}`}
                                     style={{ padding: '2px 4px', fontSize: '10px', height: '24px', minWidth: '24px' }}
                                     onClick={() => {
                                       const current = u.admin_permissions || [];
                                       const next = current.includes(p.id) ? current.filter((x: string) => x !== p.id) : [...current, p.id];
                                       adminAction('update_sub_admin_permissions', { userId: u.id, permissions: next });
                                     }}
                                   >
                                     {p.label}
                                   </button>
                                 ))}
                               </div>
                             )}
                          </div>
                        </td>
                        <td><span className={`badge badge-${u.status || 'active'}`}>{u.status || 'active'}</span></td>
                        <td>{new Date(u.created_at).toLocaleDateString()}</td>
                        <td>
                          <div className={styles.actionRow}>
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
                </table></div>
              </div>
            )}

            {activeTab === 'products' && (
              <div className={styles.sectionCard}>
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%', border: '1px solid var(--border)', borderRadius: '8px' }}><table className={styles.table}>
                  <thead>
                    <tr><th>Product</th><th>Brand & Campus</th><th>Price</th><th>Stock</th><th>Actions</th></tr>
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
                        <td>
                          <div style={{ fontWeight: 600 }}>{p.brands?.name || 'Unknown'}</div>
                          <div className={styles.subText} style={{ fontSize: '0.7rem' }}>📍 {p.universities?.abbreviation || 'General'}</div>
                        </td>
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
                </table></div>

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
            
            {activeTab === 'promotions' && (
              <div className={styles.sectionCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                  <div>
                    <h2>Live Promotions & Spotlights</h2>
                    <p className={styles.subText}>Monitor active billboards and flash sale campaigns across the hub.</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                   <div className={styles.promoSubSection}>
                      <h3>🏠 Active Billboards</h3>
                      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%', border: '1px solid var(--border)', borderRadius: '8px' }}><table className={styles.table}>
                         <thead><tr><th>Brand</th><th>Expires</th></tr></thead>
                         <tbody>
                            {vendors.filter(v => v.billboard_boost_expires_at && new Date(v.billboard_boost_expires_at) > new Date()).map(v => (
                               <tr key={v.id}>
                                  <td>{v.name}</td>
                                  <td>{new Date(v.billboard_boost_expires_at).toLocaleDateString()}</td>
                               </tr>
                            ))}
                            {vendors.filter(v => v.billboard_boost_expires_at && new Date(v.billboard_boost_expires_at) > new Date()).length === 0 && (
                               <tr><td colSpan={2} style={{ textAlign: 'center' }} className={styles.subText}>No active billboards</td></tr>
                            )}
                         </tbody>
                      </table></div>
                   </div>
                   <div className={styles.promoSubSection}>
                      <h3>⚡ Active Flash Sales</h3>
                      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%', border: '1px solid var(--border)', borderRadius: '8px' }}><table className={styles.table}>
                         <thead><tr><th>Product</th><th>Price</th><th>Brand</th></tr></thead>
                         <tbody>
                            {products.filter(p => p.is_flash_sale).map(p => (
                               <tr key={p.id}>
                                  <td>{p.title}</td>
                                  <td style={{ color: 'var(--primary)', fontWeight: 700 }}>₦{Number(p.flash_sale_price || p.price).toLocaleString()}</td>
                                  <td>{p.brands?.name}</td>
                               </tr>
                            ))}
                            {products.filter(p => p.is_flash_sale).length === 0 && (
                               <tr><td colSpan={3} style={{ textAlign: 'center' }} className={styles.subText}>No active flash sales</td></tr>
                            )}
                         </tbody>
                      </table></div>
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

                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%', border: '1px solid var(--border)', borderRadius: '8px' }}><table className={styles.table}>
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
                </table></div>
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
                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%', border: '1px solid var(--border)', borderRadius: '8px' }}><table className={styles.table}>
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
                        <td>
                          <div style={{ fontWeight: 600 }}>{o.brands?.name}</div>
                          <div className={styles.subText} style={{ fontSize: '0.7rem' }}>📍 {o.universities?.abbreviation || 'General'}</div>
                        </td>
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
                </table></div>
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
                 <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%', border: '1px solid var(--border)', borderRadius: '8px' }}><table className={styles.table} style={{ marginTop: '1rem' }}>
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
                         <td>
                           <div style={{ display: 'flex', flexDirection: 'column' }}>
                             <span className={`badge badge-${req.role}`}>{req.role}</span>
                             <span className={styles.subText} style={{ fontSize: '0.65rem' }}>📍 {req.universities?.abbreviation || 'General'}</span>
                           </div>
                         </td>
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
                 </table></div>
               </div>
             )}

              {activeTab === 'settings' && (
                <div className={styles.sectionCard}>
                  <h2>Platform Configuration</h2>
                  
                  <div style={{ marginTop: '2rem' }}>
                    <h3>Power Plans & Feature Toggles</h3>
                    <p className={styles.subText}>Tick the features to activate them for each plan. Vendors will only see activated features.</p>
                    
                    <div className={styles.settingsGrid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                      {['free', 'quarter', 'half', 'full'].map((tierId) => {
                        const tier = platformSettings?.subscription_rates?.find((t: any) => t.id === tierId) || { id: tierId, name: tierId.toUpperCase(), price: 0, features: [] };
                        const isFree = tierId === 'free';
                        const currentFeatures = platformSettings?.plan_features?.[tierId] || [];
                        const maxProducts = isFree ? (platformSettings?.free_tier_config?.max_products || 10) : (tier.max_products || 50);

                        return (
                          <div key={tierId} className={styles.settingsBox} style={{ border: isFree ? '2px solid var(--primary)' : '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                               <h4 style={{ margin: 0, color: 'var(--primary)' }}>{tier.name} {isFree && '(Default)'}</h4>
                               {!isFree && (
                                 <input 
                                   type="number" 
                                   className="input-sm" 
                                   style={{ width: '100px' }} 
                                   value={tier.price} 
                                   onChange={(e) => {
                                      const rates = [...platformSettings.subscription_rates];
                                      const idx = rates.findIndex(r => r.id === tierId);
                                      rates[idx].price = Number(e.target.value);
                                      setPlatformSettings({ ...platformSettings, subscription_rates: rates });
                                   }}
                                 />
                               )}
                            </div>
                            
                            <div style={{ marginTop: '1rem' }}>
                               <label className={styles.subText}>Listing Credits (Max Products)</label>
                               <input 
                                 type="number" 
                                 className="input" 
                                 value={maxProducts}
                                 onChange={(e) => {
                                    const val = Number(e.target.value);
                                    if (isFree) {
                                       setPlatformSettings({ ...platformSettings, free_tier_config: { ...platformSettings.free_tier_config, max_products: val } });
                                    } else {
                                       const rates = [...platformSettings.subscription_rates];
                                       const idx = rates.findIndex(r => r.id === tierId);
                                       rates[idx].max_products = val;
                                       setPlatformSettings({ ...platformSettings, subscription_rates: rates });
                                    }
                                 }}
                               />
                            </div>

                            <div style={{ marginTop: '1rem' }}>
                               <label className={styles.subText}>Active Features</label>
                               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                                  {[
                                    { id: 'whatsapp_chat', label: 'WhatsApp Chat' },
                                    { id: 'verified_badge', label: 'Verified Badge' },
                                    { id: 'promo_codes', label: 'Promo Codes' },
                                    { id: 'campus_nudges', label: 'Campus Nudges' },
                                    { id: 'billboard_access', label: 'Billboard Boost' },
                                    { id: 'advanced_analytics', label: 'Adv. Analytics' },
                                    { id: 'priority_support', label: 'Priority Support' },
                                    { id: 'reels_unlimited', label: 'Unlimited Reels' }
                                  ].map(feat => (
                                    <label key={feat.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                                       <input 
                                         type="checkbox" 
                                         checked={currentFeatures.includes(feat.id)}
                                         onChange={(e) => {
                                            const updatedFeatures = e.target.checked 
                                              ? [...currentFeatures, feat.id] 
                                              : currentFeatures.filter((f: string) => f !== feat.id);
                                            setPlatformSettings({
                                               ...platformSettings,
                                               plan_features: {
                                                  ...platformSettings.plan_features,
                                                  [tierId]: updatedFeatures
                                               }
                                            });
                                         }}
                                       />
                                       {feat.label}
                                    </label>
                                  ))}
                               </div>
                            </div>
                            <button className="btn btn-primary btn-sm w-full mt-3" onClick={() => {
                               adminAction('update_settings', { key: 'subscription_rates', value: platformSettings.subscription_rates });
                               adminAction('update_settings', { key: 'plan_features', value: platformSettings.plan_features });
                               if (isFree) adminAction('update_settings', { key: 'free_tier_config', value: platformSettings.free_tier_config });
                            }}>Save Plan Config</button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ marginTop: '3rem' }}>
                    <h3>Visibility Booster Plans</h3>
                    <p className={styles.subText}>Separate from monthly plans, these allow vendors to buy temporary visibility spikes.</p>
                    <div className={styles.settingsGrid}>
                       {['visibility_week', 'visibility_month'].map(vid => (
                         <div key={vid} className={styles.settingsBox}>
                            <label>{vid === 'visibility_week' ? '7-Day Boost' : '30-Day Boost'} Price (₦)</label>
                            <input 
                              type="number" 
                              className="input" 
                              defaultValue={vid === 'visibility_week' ? 1500 : 5000} 
                              onBlur={(e) => adminAction('update_visibility_price', { id: vid, price: Number(e.target.value) })}
                            />
                         </div>
                       ))}
                    </div>
                  </div>
                </div>
              )}

             {activeTab === 'reviews' && (
               <div className={styles.sectionCard}>
                 <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%', border: '1px solid var(--border)', borderRadius: '8px' }}><table className={styles.table}>
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
                         <td>{r.rating} ⭐ </td>
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
                 </table></div>
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
                    <option value="university_all">🎓 Specific University (All)</option>
                    <option value="university_vendors">🏪 Specific University (Vendors)</option>
                    <option value="specific">🎯 Specific User ID</option>
                  </select>
                  {(notifForm.target === 'university_all' || notifForm.target === 'university_vendors') && (
                    <select 
                      className="input"
                      onChange={e => setNotifForm(f => ({ ...f, universityId: e.target.value }))}
                    >
                      <option value="">Select University...</option>
                      {universities.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  )}
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
                          addToast('Notification sent successfully!', 'success');
                          setNotifForm({ title: '', content: '', target: 'all', userId: '', universityId: '' });
                        } else {
                          addToast(data.error || 'Failed to send notification', 'error');
                        }
                      } catch (e) {
                        addToast('Connection error', 'error');
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
                  <div style={{ display: 'flex', gap: '1rem' }}>
                     <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => confirm('⚠️ DANGER: Reset all market reviews and product ratings to 0?') && adminAction('reset_all_reviews', {})}>
                       <Trash2 size={14} /> Reset Market Reviews to 0
                     </button>
                     <button className="btn btn-primary btn-sm" onClick={() => adminAction('recalculate_ratings', {})}>
                       <RefreshCw size={14} /> Recalculate All Vendor Ratings
                     </button>
                  </div>
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
                  <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%', border: '1px solid var(--border)', borderRadius: '8px' }}><table className={styles.table}>
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
                  </table></div>
                </div>
              </div>
            )}

            {activeTab === 'universities' && (
              <div className={styles.content} style={{ padding: selectedUniId ? '0' : '1.5rem' }}>
                {!selectedUniId ? (
                  <>
                    <div className={styles.header}>
                      <div>
                        <h1>Universities & Campus Teams</h1>
                        <p className={styles.subText}>Manage all universities and assign their administrative hierarchies</p>
                      </div>
                      <button className="btn btn-ghost" onClick={fetchAll}><RefreshCw size={16} /> Sync</button>
                    </div>

                    <div className={styles.sectionsGrid}>
                      <div className={styles.sectionCard}>
                        <h3 style={{ marginBottom: '1.5rem' }}>University List</h3>
                        <div className={styles.tableWrap}>
                          <table className={styles.table}>
                            <thead>
                              <tr>
                                <th>University</th>
                                <th>Location</th>
                                <th>Admins</th>
                                <th>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {universities.map(u => (
                                <tr key={u.id}>
                                  <td style={{ cursor: 'pointer' }} onClick={() => { setSelectedUniId(u.id); fetchUniData(u.id); }}>
                                    <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{u.abbreviation}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-400)' }}>{u.name}</div>
                                  </td>
                                  <td>{u.location}</td>
                                  <td><span className="badge badge-primary">{u.adminCount || 0}</span></td>
                                  <td>
                                    <button 
                                      className="btn btn-icon text-red" 
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (!confirm(`Delete ${u.name}? This will affect all associated vendors.`)) return;
                                        const res = await adminFetch('/api/universities', { method: 'DELETE', body: JSON.stringify({ id: u.id }) });
                                        if (res.ok) { fetchAll(); addToast('University deleted', 'success'); }
                                      }}
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className={styles.settingsBox}>
                          <h3 style={{ marginBottom: '1rem' }}>Add New University</h3>
                          <input
                            className="form-input mb-2"
                            placeholder="Full University Name *"
                            value={uniForm.name}
                            onChange={e => setUniForm({ ...uniForm, name: e.target.value })}
                          />
                          <input
                            className="form-input mb-2"
                            placeholder="Abbreviation (e.g. ABUAD)"
                            value={uniForm.abbreviation}
                            onChange={e => setUniForm({ ...uniForm, abbreviation: e.target.value })}
                          />
                          <input
                            className="form-input mb-2"
                            placeholder="Location (City, State)"
                            value={uniForm.location}
                            onChange={e => setUniForm({ ...uniForm, location: e.target.value })}
                          />
                          <button
                            className="btn btn-primary w-full"
                            disabled={uniCreating || !uniForm.name}
                            onClick={async () => {
                              setUniCreating(true);
                              try {
                                const res = await adminFetch('/api/universities', { method: 'POST', body: JSON.stringify({ action: 'create', ...uniForm }) });
                                const d = await res.json();
                                if (d.success) { 
                                  await fetchAll(); 
                                  setUniForm({ name: '', location: '', abbreviation: '' }); 
                                  addToast('University created successfully!', 'success');
                                }
                                else addToast(d.error || 'Failed', 'error');
                              } catch { addToast('Network error', 'error'); }
                              setUniCreating(false);
                            }}
                          >
                            {uniCreating ? 'Creating...' : '+ Create University'}
                          </button>
                        </div>

                        <div className={styles.settingsBox}>
                          <h3 style={{ marginBottom: '1rem' }}>Assign University Admin</h3>
                          <div className="mb-2" style={{ position: 'relative' }}>
                            <input 
                              className="form-input" 
                              placeholder="Search user by name or email..." 
                              value={adminSearch}
                              onChange={e => setAdminSearch(e.target.value)}
                            />
                            {adminSearch && (
                              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-100)', border: '1px solid var(--border)', borderRadius: '8px', zIndex: 10, maxHeight: '200px', overflowY: 'auto' }}>
                                {users.filter(u => u.name?.toLowerCase().includes(adminSearch.toLowerCase()) || u.email?.toLowerCase().includes(adminSearch.toLowerCase())).slice(0, 5).map(u => (
                                  <div 
                                    key={u.id} 
                                    style={{ padding: '0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                                    onClick={() => {
                                      setSelectedAdminId(u.id);
                                      setAdminSearch(`${u.name} (${u.email})`);
                                    }}
                                  >
                                    <strong>{u.name}</strong>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-400)' }}>{u.email}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          
                          <select id="assign-uni-id" className="form-input mb-2">
                            <option value="">-- Select University --</option>
                            {universities.map((u: any) => (
                              <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>
                            ))}
                          </select>
                          <button
                            className="btn btn-primary w-full"
                            onClick={async () => {
                              const universityId = (document.getElementById('assign-uni-id') as HTMLSelectElement)?.value;
                              if (!selectedAdminId || !universityId) return addToast('User and University required', 'error');
                              const res = await adminFetch('/api/universities', { method: 'POST', body: JSON.stringify({ action: 'assign_admin', userId: selectedAdminId, universityId }) });
                              const d = await res.json();
                              if (d.success) { 
                                addToast('University Admin assigned successfully!', 'success'); 
                                setAdminSearch('');
                                setSelectedAdminId('');
                                await fetchAll(); 
                              }
                              else addToast(d.error || 'Failed', 'error');
                            }}
                          >
                            Assign as University Admin
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className={styles.sectionCard} style={{ marginTop: '1.5rem' }}>
                      <h3>University Admin Teams</h3>
                      <p className={styles.subText} style={{ marginBottom: '1.5rem' }}>Management hierarchy for each university</p>
                      
                      <div className={styles.tableWrap}>
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>Lead Admin</th>
                              <th>University</th>
                              <th>Team Members</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {universityAdmins.map(admin => {
                              const adminTeam = teams.filter(t => t.admin_id === admin.id);
                              return (
                                <tr key={admin.id}>
                                  <td>
                                    <div style={{ fontWeight: 700 }}>{admin.name}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-400)' }}>{admin.email}</div>
                                  </td>
                                  <td>{admin.universities?.name || 'Unknown'}</td>
                                  <td>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                      {adminTeam.map(m => (
                                        <div key={m.id} className="badge badge-gold" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                          {m.member?.name} ({m.role})
                                          <XCircle size={12} style={{ cursor: 'pointer' }} onClick={async () => {
                                            await adminFetch('/api/admin', { method: 'POST', body: JSON.stringify({ action: 'remove_team_member', teamId: m.id }) });
                                            fetchAll();
                                            addToast('Team member removed', 'success');
                                          }} />
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                  <td>
                                    <button 
                                      className="btn btn-ghost text-red"
                                      onClick={async () => {
                                        if (!confirm(`Revoke admin status for ${admin.name}?`)) return;
                                        await adminFetch('/api/universities', { method: 'POST', body: JSON.stringify({ action: 'revoke_admin', userId: admin.id }) });
                                        fetchAll();
                                        addToast('Admin status revoked', 'success');
                                      }}
                                    >
                                      Revoke Admin
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ background: 'var(--bg-100)', minHeight: '80vh', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                    <div className={styles.header} style={{ padding: '1.5rem', background: 'var(--bg-200)', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <button className="btn btn-icon" onClick={() => setSelectedUniId(null)}><ArrowLeft size={18} /></button>
                          <div>
                            <h2 style={{ margin: 0 }}>{universities.find(u => u.id === selectedUniId)?.name}</h2>
                            <p className={styles.subText}>Full Campus Management & Staff Hierarchy</p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                           <span className="badge badge-verified">Active Ecosystem</span>
                        </div>
                      </div>
                    </div>

                    {uniStats && (
                      <div className={styles.statsGrid} style={{ padding: '2rem 2rem 0 2rem', marginBottom: 0 }}>
                        {[
                          { label: 'Campus Users', val: uniStats.userCount, color: '#3b82f6', Icon: Users },
                          { label: 'Local Vendors', val: uniStats.brandCount, color: '#10b981', Icon: Store },
                          { label: 'Uni Revenue', val: `â‚¦${Number(uniStats.totalRevenue || 0).toLocaleString()}`, color: '#f59e0b', Icon: ShoppingCart },
                          { label: 'Live Products', val: uniStats.productCount, color: '#8b5cf6', Icon: ShoppingBag },
                        ].map(({ label, val, color, Icon }) => (
                          <div className={styles.statCard} key={label} style={{ background: 'var(--bg-200)' }}>
                            <div className={styles.statInfo}><p>{label}</p><h3>{val}</h3></div>
                            <div className={styles.statIcon} style={{ color }}><Icon size={20} /></div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ padding: '2rem', display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div className={styles.sectionCard} style={{ margin: 0 }}>
                          <div className={styles.sectionHeader}>
                            <h3>Enrolled Students & Staff</h3>
                            <div className={styles.liveBadge}><span className={styles.liveDot} /> {uniUsers.length} Users</div>
                          </div>
                          <div className={styles.tableWrap} style={{ maxHeight: '500px' }}>
                            <table className={styles.table}>
                              <thead>
                                <tr>
                                  <th>Identity</th>
                                  <th>Board Role</th>
                                  <th>Status</th>
                                  <th>Joined</th>
                                  <th>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filterBy(uniUsers, ['name', 'email']).map((u: any) => (
                                  <tr key={u.id} style={{ cursor: 'pointer' }} onClick={() => { setAdminSearch(u.name); setSelectedAdminId(u.id); }}>
                                    <td>
                                      <div style={{ fontWeight: 600 }}>{u.name}</div>
                                      <div className={styles.subText}>{u.email}</div>
                                    </td>
                                    <td>
                                      <span className={`badge ${u.role === 'admin' ? 'badge-verified' : u.role === 'vendor' ? 'badge-gold' : 'badge-ghost'}`}>{u.role}</span>
                                    </td>
                                    <td><span className={u.status === 'active' ? 'text-green' : 'text-red'}>{u.status}</span></td>
                                    <td className={styles.subText}>{new Date(u.created_at).toLocaleDateString()}</td>
                                    <td>
                                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); adminAction('toggle_user_status', { userId: u.id, status: u.status === 'active' ? 'suspended' : 'active' }); }}>
                                          {u.status === 'active' ? 'Suspend' : 'Activate'}
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div className={styles.settingsBox} style={{ background: 'var(--bg-200)', border: '1px solid var(--primary)' }}>
                          <h4 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>Add to Management Team</h4>
                          <p className={styles.subText} style={{ marginBottom: '1rem' }}>Assign delegated permissions for this university's sub-dashboards.</p>
                          
                          <div className="mb-3">
                            <label className={styles.subText}>Selected Member</label>
                            <input className="form-input" readOnly value={adminSearch || 'Click a user from the list'} />
                          </div>

                          <div className="mb-3">
                            <label className={styles.subText}>Staff Role</label>
                            <select id="staff-role" className="form-input">
                              <option value="Campus Admin">Campus Admin</option>
                              <option value="Finance Lead">Finance Lead</option>
                              <option value="Catalog Manager">Catalog Manager</option>
                              <option value="User Support">User Support</option>
                              <option value="Logistics Head">Logistics Head</option>
                            </select>
                          </div>

                          <div className="mb-4">
                            <label className={styles.subText} style={{ display: 'block', marginBottom: '0.75rem' }}>Permissions Access</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.6rem' }}>
                              {[
                                { id: 'overview', label: 'Overview & Stats' },
                                { id: 'vendors', label: 'Vendors & Verification' },
                                { id: 'catalog', label: 'Catalog (Products)' },
                                { id: 'users', label: 'User Management' }
                              ].map(p => (
                                <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem', cursor: 'pointer', padding: '0.5rem', background: 'var(--bg-300)', borderRadius: '6px' }}>
                                  <input type="checkbox" id={`perm-${p.id}`} style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }} />
                                  {p.label}
                                </label>
                              ))}
                            </div>
                          </div>

                          <button 
                            className="btn btn-primary w-full"
                            style={{ height: '48px', fontWeight: 700 }}
                            onClick={async () => {
                              const perms = ['overview', 'vendors', 'catalog', 'users'].filter(p => (document.getElementById(`perm-${p}`) as HTMLInputElement)?.checked);
                              if (!selectedAdminId) return addToast('Please select a user first', 'error');
                              
                              const res = await adminFetch('/api/admin', { 
                                method: 'POST', 
                                body: JSON.stringify({ 
                                  action: 'add_team_member', 
                                  universityId: selectedUniId,
                                  memberId: selectedAdminId,
                                  role: (document.getElementById('staff-role') as HTMLSelectElement)?.value || 'campus_staff',
                                  permissions: perms
                                }) 
                              });
                              if (res.ok) {
                                addToast('Team updated successfully!', 'success');
                                setAdminSearch('');
                                setSelectedAdminId('');
                                fetchUniData(selectedUniId!);
                              }
                            }}
                          >
                            Save Team Changes
                          </button>
                        </div>

                        <div className={styles.sectionCard} style={{ margin: 0, padding: '1.25rem' }}>
                          <h4 style={{ marginBottom: '1rem' }}>Active Team Members</h4>
                          {uniTeams.length === 0 ? (
                            <p className={styles.subText}>No staff assigned yet.</p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                              {uniTeams.map(m => (
                                <div key={m.id} style={{ padding: '0.75rem', background: 'var(--bg-200)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                      <strong style={{ fontSize: '0.85rem' }}>{m.member?.name}</strong>
                                      <span className="badge badge-primary" style={{ fontSize: '0.65rem', width: 'fit-content', marginTop: '4px' }}>{m.role || 'Campus Staff'}</span>
                                    </div>
                                    <Trash2 size={14} style={{ color: '#ef4444', cursor: 'pointer' }} onClick={async () => {
                                      if(!confirm('Remove this member?')) return;
                                      await adminFetch('/api/admin', { method: 'POST', body: JSON.stringify({ action: 'remove_team_member', teamId: m.id }) });
                                      fetchUniData(selectedUniId!);
                                      addToast('Member removed', 'success');
                                    }} />
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.5rem' }}>
                                    {m.permissions?.map((p: string) => (
                                      <span key={p} className="badge badge-ghost" style={{ fontSize: '0.6rem', padding: '0.1rem 0.4rem', background: 'rgba(255,255,255,0.05)' }}>{p}</span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className={styles.settingsBox} style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid #f59e0b' }}>
                          <h4 style={{ color: '#f59e0b', marginBottom: '1rem' }}>Campus Rate Overrides</h4>
                          <p className={styles.subText} style={{ marginBottom: '1rem' }}>Set custom booster and subscription rates specifically for this campus.</p>
                          
                          <div className="mb-3">
                            <label className={styles.subText}>Sub. Discount Rate (%)</label>
                            <input 
                              type="number" 
                              className="form-input" 
                              placeholder="e.g. 10" 
                              onChange={(e) => adminAction('update_uni_config', { universityId: selectedUniId, key: 'sub_discount', value: e.target.value })}
                            />
                          </div>
                          
                          <div className="mb-3">
                            <label className={styles.subText}>Booster Premium Multiplier</label>
                            <input 
                              type="number" 
                              className="form-input" 
                              placeholder="e.g. 1.5" 
                              onChange={(e) => adminAction('update_uni_config', { universityId: selectedUniId, key: 'boost_multiplier', value: e.target.value })}
                            />
                          </div>
                          
                          <p className={styles.subText} style={{ fontSize: '0.7rem', fontStyle: 'italic' }}>* Overrides take effect immediately for new transactions on this campus.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
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

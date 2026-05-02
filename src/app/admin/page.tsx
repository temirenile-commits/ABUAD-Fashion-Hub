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

type Tab = 'overview' | 'universities' | 'vendors' | 'products' | 'users' | 'financials' | 'orders' | 'settings' | 'reviews' | 'notices' | 'market' | 'delivery_agents' | 'promotions' | 'merchandising';

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
  const [homepageSections, setHomepageSections] = useState<any[]>([]);
  const [sectionForm, setSectionForm] = useState<any>({ title: '', type: 'manual', layout_type: 'horizontal_scroll', is_active: true, priority: 0, auto_rule: { criteria: 'limited_stock', threshold: 5, limit: 12 } });
  const [editingSection, setEditingSection] = useState<any>(null);
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
  const [uniStats, setUniStats] = useState<any>(null);
  const [uniConfig, setUniConfig] = useState<any>({});
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
      setHomepageSections(statsD.sections || []);
      
      setUniversityAdmins(uniJson[0].admins || []);
      setTeams(uniJson[1].teams || []);

      const manualB = (settingsD.settings?.manual_billboards as any[]) || [];
      setManualBillboards(manualB);

    } catch (e: any) {
      console.error('Admin fetch error:', e);
      setError('Connection error: Could not reach the administration server.');
    }
    setLoading(false);
  }, []);


  const fetchUniData = async (uniId: string) => {
    setUniLoading(true);
    setUniUsers([]); // Clear to avoid mix-up
    setUniTeams([]);
    setUniStats(null);
    setUniConfig({});
    try {
      const [uRes, tRes, sRes, cRes] = await Promise.all([
        adminFetch(`/api/admin?action=university_users&uniId=${uniId}`),
        adminFetch(`/api/admin?action=university_teams&uniId=${uniId}`),
        adminFetch(`/api/admin?action=stats&uniId=${uniId}`),
        uniId === 'global' ? adminFetch(`/api/admin?action=settings`) : adminFetch(`/api/admin?action=university_config&uniId=${uniId}`)
      ]);
      const [uData, tData, sData, cData] = await Promise.all([uRes.json(), tRes.json(), sRes.json(), cRes.json()]);
      
      setUniUsers((uData.users || []).filter((u: any) => u.role !== 'admin'));
      setUniTeams(tData.teams || []);
      setUniStats(sData.stats || null);
      
      if (uniId === 'global') {
        // Map global settings to the uniConfig format so the UI works without changes
        const gConfig = {
          credit_price: cData.settings?.credit_price || 50,
          billboard_price: cData.settings?.boost_rates?.find((b:any)=>b.id==='billboard_boost')?.price || 500,
          plans: (cData.settings?.subscription_rates || []).reduce((acc:any, r:any) => {
             acc[r.id] = { price: r.price, features: [] }; // global features aren't structured the same but price is what matters
             return acc;
          }, {})
        };
        setUniConfig(gConfig);
      } else {
        setUniConfig(cData.config || {});
      }
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

  const [manualBillboards, setManualBillboards] = useState<any[]>([]);
  const [billboardUpload, setBillboardUpload] = useState({ title: '', sub: '', link: '', file: null as File|null });
  const [uploadingBillboard, setUploadingBillboard] = useState(false);

  const handleBillboardUpload = async () => {
    if (!billboardUpload.file || !billboardUpload.title) return addToast('Image and Title required', 'error');
    setUploadingBillboard(true);
    try {
      const ext = billboardUpload.file.name.split('.').pop();
      const path = `manual_billboards/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('products').upload(path, billboardUpload.file);
      if (uploadError) throw uploadError;
      
      const { data } = supabase.storage.from('products').getPublicUrl(path);
      
      await adminAction('add_manual_billboard', {
         title: billboardUpload.title,
         description: billboardUpload.sub,
         link: billboardUpload.link,
         cover_url: data.publicUrl
      });
      
      const newB = { id: `mb_${Date.now()}`, title: billboardUpload.title, description: billboardUpload.sub, link: billboardUpload.link, cover_url: data.publicUrl };
      setManualBillboards([...manualBillboards, newB]);
      setBillboardUpload({ title: '', sub: '', link: '', file: null });
      addToast('Billboard added successfully!', 'success');
    } catch(e:any) { addToast(e.message, 'error'); }
    setUploadingBillboard(false);
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
            ['merchandising', 'Merchandising', Tag],
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
                    <tr><th>Product</th><th>Brand & Campus</th><th>Price</th><th>Visibility</th><th>Stock</th><th>Actions</th></tr>
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
                        <td>
                          <span className={styles.badge} style={{ background: p.visibility_type === 'global' ? 'var(--primary-soft)' : 'rgba(255,255,255,0.1)', color: p.visibility_type === 'global' ? 'var(--primary)' : 'var(--text-100)' }}>
                            {p.visibility_type === 'global' ? '🌍 Global' : '🎓 Campus'}
                          </span>
                        </td>
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

                 <div style={{ marginTop: '3rem', padding: '2rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <h3>➕ Add Manual Billboard</h3>
                    <p className={styles.subText} style={{ marginBottom: '1.5rem' }}>Upload a custom promotional banner for the homepage slider.</p>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                       <div>
                          <label className={styles.subText}>Banner Title</label>
                          <input 
                            className="form-input w-full mt-2" 
                            placeholder="e.g. Summer Mega Sale" 
                            value={billboardUpload.title}
                            onChange={e => setBillboardUpload({...billboardUpload, title: e.target.value})}
                          />
                       </div>
                       <div>
                          <label className={styles.subText}>Description</label>
                          <input 
                            className="form-input w-full mt-2" 
                            placeholder="e.g. Up to 50% off all items" 
                            value={billboardUpload.sub}
                            onChange={e => setBillboardUpload({...billboardUpload, sub: e.target.value})}
                          />
                       </div>
                       <div>
                          <label className={styles.subText}>Click Link (Optional)</label>
                          <input 
                            className="form-input w-full mt-2" 
                            placeholder="e.g. /explore?cat=sale" 
                            value={billboardUpload.link}
                            onChange={e => setBillboardUpload({...billboardUpload, link: e.target.value})}
                          />
                       </div>
                       <div>
                          <label className={styles.subText}>Banner Image</label>
                          <input 
                            type="file"
                            accept="image/*"
                            className="form-input w-full mt-2" 
                            onChange={e => setBillboardUpload({...billboardUpload, file: e.target.files?.[0] || null})}
                          />
                       </div>
                    </div>
                    
                    <button 
                      className="btn btn-primary mt-6" 
                      style={{ minWidth: '200px' }}
                      disabled={uploadingBillboard}
                      onClick={handleBillboardUpload}
                    >
                       {uploadingBillboard ? <Loader2 size={18} className="spin" /> : 'Upload Billboard 🚀'}
                    </button>
                 </div>

                 {manualBillboards.length > 0 && (
                   <div style={{ marginTop: '3rem' }}>
                      <h3>📋 Existing Manual Billboards</h3>
                      <div className={styles.settingsGrid} style={{ marginTop: '1.5rem' }}>
                         {manualBillboards.map((mb, idx) => (
                           <div key={mb.id || idx} className={styles.settingsBox} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                              <img src={mb.cover_url} style={{ width: '80px', height: '45px', objectFit: 'cover', borderRadius: '4px' }} />
                              <div style={{ flex: 1 }}>
                                 <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{mb.title}</div>
                                 <div className={styles.subText} style={{ fontSize: '0.75rem' }}>{mb.university_id ? '🎓 Campus Specific' : '🌍 Global'}</div>
                              </div>
                              <button 
                                className="btn btn-ghost btn-sm" 
                                style={{ color: '#ef4444' }}
                                onClick={() => {
                                  if (!confirm('Remove this billboard?')) return;
                                  // Logic to remove billboard could be added to API too
                                  addToast('Delete logic not yet in API, but will be removed from state', 'info');
                                  setManualBillboards(manualBillboards.filter(b => b.id !== mb.id));
                                }}
                              >
                                <Trash2 size={16} />
                              </button>
                           </div>
                         ))}
                      </div>
                   </div>
                 )}
              </div>
            )}

            {activeTab === 'merchandising' && (
              <div className={styles.sectionCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                  <div>
                    <h2>Homepage Merchandising</h2>
                    <p className={styles.subText}>Manage dynamic sections, automated rules, and scheduled campaigns.</p>
                  </div>
                  <button className="btn btn-primary" onClick={() => { setEditingSection(null); setSectionForm({ title: '', type: 'manual', layout_type: 'horizontal_scroll', is_active: true, priority: 0, auto_rule: { criteria: 'limited_stock', threshold: 5, limit: 12 } }); (document.getElementById('section-modal') as any)?.showModal(); }}>
                    + New Section
                  </button>
                </div>

                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Section Title</th>
                        <th>Type</th>
                        <th>Layout</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th>University</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {homepageSections.map(sec => (
                        <tr key={sec.id}>
                          <td>
                            <div style={{ fontWeight: 700 }}>{sec.title}</div>
                            {sec.description && <div className={styles.subText} style={{ fontSize: '0.75rem' }}>{sec.description}</div>}
                          </td>
                          <td>
                            <span className={`badge ${sec.type === 'manual' ? 'badge-gold' : 'badge-verified'}`}>
                              {sec.type.toUpperCase()}
                            </span>
                            {sec.type === 'automated' && <div className={styles.subText} style={{ fontSize: '0.65rem', marginTop: '4px' }}>Rule: {sec.auto_rule?.criteria}</div>}
                          </td>
                          <td><span className="badge badge-ghost">{sec.layout_type}</span></td>
                          <td>{sec.priority}</td>
                          <td><span className={sec.is_active ? 'text-green' : 'text-red'}>{sec.is_active ? 'Active' : 'Inactive'}</span></td>
                          <td>{sec.universities?.abbreviation || 'Global'}</td>
                          <td>
                            <div className={styles.actionRow}>
                              <button className="btn btn-ghost btn-sm" onClick={() => { setEditingSection(sec); setSectionForm(sec); (document.getElementById('section-modal') as any)?.showModal(); }}>
                                <Settings size={14} />
                              </button>
                              {sec.type === 'manual' && (
                                <button className="btn btn-ghost btn-sm" title="Manage Products" onClick={() => { setEditingSection(sec); (document.getElementById('product-picker-modal') as any)?.showModal(); }}>
                                  <ShoppingBag size={14} />
                                </button>
                              )}
                              <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444' }} onClick={() => confirm('Delete this section?') && adminAction('delete_homepage_section', { id: sec.id })}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {homepageSections.length === 0 && (
                        <tr><td colSpan={7} style={{ textAlign: 'center' }} className={styles.subText}>No sections configured. Create one to populate the homepage.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Section Form Modal */}
                <dialog id="section-modal" className={styles.modal} style={{ padding: 0 }}>
                  <div className={styles.modalContent} style={{ maxWidth: '500px' }}>
                    <div className={styles.modalHeader}>
                      <h3>{editingSection ? 'Edit Section' : 'Create New Section'}</h3>
                      <button className="btn btn-icon" onClick={() => (document.getElementById('section-modal') as any)?.close()}><XCircle size={20} /></button>
                    </div>
                    <div className={styles.modalBody} style={{ padding: '1.5rem' }}>
                      <div className="form-group mb-4">
                        <label className="form-label">Title</label>
                        <input className="form-input" value={sectionForm.title} onChange={e => setSectionForm({...sectionForm, title: e.target.value})} placeholder="e.g. Limited Stock Deals" />
                      </div>
                      <div className="form-group mb-4">
                        <label className="form-label">Description (Optional)</label>
                        <input className="form-input" value={sectionForm.description || ''} onChange={e => setSectionForm({...sectionForm, description: e.target.value})} placeholder="Short subtitle" />
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="form-label">Type</label>
                          <select className="form-input" value={sectionForm.type} onChange={e => setSectionForm({...sectionForm, type: e.target.value})}>
                            <option value="manual">Manual Selection</option>
                            <option value="automated">System Automated</option>
                          </select>
                        </div>
                        <div>
                          <label className="form-label">Layout</label>
                          <select className="form-input" value={sectionForm.layout_type} onChange={e => setSectionForm({...sectionForm, layout_type: e.target.value})}>
                            <option value="horizontal_scroll">Horizontal Scroll</option>
                            <option value="grid">Grid (Recommended for large lists)</option>
                            <option value="banner">Promotional Banner</option>
                          </select>
                        </div>
                      </div>

                      {sectionForm.type === 'automated' && (
                        <div className={styles.settingsBox} style={{ background: 'var(--bg-300)', marginBottom: '1.5rem' }}>
                          <h4 style={{ marginBottom: '1rem' }}>Automation Rules</h4>
                          <div className="form-group mb-3">
                            <label className="subText">Criteria</label>
                            <select className="form-input" value={sectionForm.auto_rule?.criteria} onChange={e => setSectionForm({...sectionForm, auto_rule: {...sectionForm.auto_rule, criteria: e.target.value}})}>
                              <option value="limited_stock">Limited Stock (Selling fast)</option>
                              <option value="trending">Trending (High Views)</option>
                              <option value="top_sellers">Top Sellers (High Sales)</option>
                              <option value="hot_deals">Hot Deals (Best Discounts)</option>
                            </select>
                          </div>
                          {sectionForm.auto_rule?.criteria === 'limited_stock' && (
                            <div className="form-group mb-3">
                              <label className="subText">Stock Threshold (Below this value)</label>
                              <input type="number" className="form-input" value={sectionForm.auto_rule?.threshold} onChange={e => setSectionForm({...sectionForm, auto_rule: {...sectionForm.auto_rule, threshold: Number(e.target.value)}})} />
                            </div>
                          )}
                          <div className="form-group">
                            <label className="subText">Display Limit</label>
                            <input type="number" className="form-input" value={sectionForm.auto_rule?.limit} onChange={e => setSectionForm({...sectionForm, auto_rule: {...sectionForm.auto_rule, limit: Number(e.target.value)}})} />
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="form-label">Priority Order</label>
                          <input type="number" className="form-input" value={sectionForm.priority} onChange={e => setSectionForm({...sectionForm, priority: Number(e.target.value)})} />
                        </div>
                        <div>
                          <label className="form-label">University (Global if empty)</label>
                          <select className="form-input" value={sectionForm.university_id || ''} onChange={e => setSectionForm({...sectionForm, university_id: e.target.value || null})}>
                            <option value="">🌍 Global</option>
                            {universities.map(u => <option key={u.id} value={u.id}>{u.abbreviation}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mb-6">
                        <input type="checkbox" checked={sectionForm.is_active} onChange={e => setSectionForm({...sectionForm, is_active: e.target.checked})} id="sec-active" />
                        <label htmlFor="sec-active" style={{ cursor: 'pointer' }}>Visible on Homepage</label>
                      </div>

                      <button className="btn btn-primary w-full" onClick={() => {
                        if (editingSection) adminAction('update_homepage_section', { id: editingSection.id, updates: sectionForm });
                        else adminAction('create_homepage_section', sectionForm);
                        (document.getElementById('section-modal') as any)?.close();
                      }}>
                        {editingSection ? 'Save Changes' : 'Create Section'}
                      </button>
                    </div>
                  </div>
                </dialog>

                {/* Product Picker Modal (For Manual Sections) */}
                <dialog id="product-picker-modal" className={styles.modal} style={{ padding: 0 }}>
                   <div className={styles.modalContent} style={{ maxWidth: '800px', height: '80vh' }}>
                      <div className={styles.modalHeader}>
                        <h3>Manage Products: {editingSection?.title}</h3>
                        <button className="btn btn-icon" onClick={() => (document.getElementById('product-picker-modal') as any)?.close()}><XCircle size={20} /></button>
                      </div>
                      <div className={styles.modalBody} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', height: 'calc(100% - 70px)', padding: '1.5rem' }}>
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden' }}>
                            <h4>Catalog</h4>
                            <div className={styles.searchBar} style={{ width: '100%' }}>
                              <Search size={14} />
                              <input placeholder="Filter products..." value={adminSearch} onChange={e => setAdminSearch(e.target.value)} />
                            </div>
                            <div style={{ overflowY: 'auto', flex: 1 }}>
                               {filterBy(products, ['title']).slice(0, 50).map(p => (
                                 <div key={p.id} className={styles.settingsBox} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', padding: '0.75rem' }}>
                                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                       <img src={p.image_url || p.media_urls?.[0]} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                                       <div>
                                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.title}</div>
                                          <div className={styles.subText} style={{ fontSize: '0.7rem' }}>{p.brands?.name}</div>
                                       </div>
                                    </div>
                                    <button className="btn btn-ghost btn-sm" onClick={() => adminAction('assign_product_to_section', { sectionId: editingSection.id, productId: p.id, position: 0 })}>Add</button>
                                 </div>
                               ))}
                            </div>
                         </div>

                         <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden' }}>
                            <h4>Assigned to this Section</h4>
                            <div style={{ overflowY: 'auto', flex: 1 }}>
                               {/* Note: In a real app, you'd fetch the specific products for this section. 
                                   For now, we'll assume the state is updated via adminAction + fetchAll. */}
                               <p className={styles.subText} style={{ fontSize: '0.8rem' }}>Added products will appear here after sync.</p>
                            </div>
                         </div>
                      </div>
                   </div>
                </dialog>
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
                  <h2>Campus Configuration & Subscription Settings</h2>
                  <p className={styles.subText}>Select a university to configure its specific subscription rates, feature availability, and booster plans.</p>

                  <div style={{ marginTop: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <label style={{ fontWeight: 600 }}>Configure University:</label>
                    <select 
                      className="form-input" 
                      style={{ maxWidth: '350px' }}
                      value={selectedUniId || ''} 
                      onChange={e => {
                        setSelectedUniId(e.target.value);
                        if (e.target.value) fetchUniData(e.target.value);
                      }}
                    >
                      <option value="">-- Select a University --</option>
                      <option value="global">🌍 Global/General Vendors Platform Config</option>
                      {universities.map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>
                      ))}
                    </select>
                    {uniLoading && <Loader2 size={18} className="spin" color="var(--primary)" />}
                  </div>

                  {selectedUniId && !uniLoading && (
                    <div style={{ marginTop: '3rem', display: 'flex', flexDirection: 'column', gap: '3rem' }}>
                      
                      {/* Subscription Plans */}
                      <div>
                        <h3>Power Plans & Credit Rates</h3>
                        <p className={styles.subText}>Configure subscription plans specifically for this campus.</p>
                        
                        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '500px' }}>
                          <div>
                            <label className={styles.subText}>Credit Listing Price (₦)</label>
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                              <input 
                                type="number" 
                                className="form-input" 
                                style={{ height: '36px' }}
                                value={uniConfig.credit_price || ''}
                                placeholder="e.g. 50"
                                onChange={(e) => setUniConfig({ ...uniConfig, credit_price: e.target.value })}
                              />
                              <button className="btn btn-primary btn-sm" onClick={() => adminAction('update_uni_config', { universityId: selectedUniId, key: 'credit_price', value: uniConfig.credit_price })}>Save</button>
                            </div>
                          </div>
                        </div>

                        <div className={styles.settingsGrid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', marginTop: '2rem' }}>
                          {['quarter', 'half', 'full'].map(tierId => {
                            const planConfig = uniConfig.plans?.[tierId] || {};
                            return (
                              <div key={tierId} className={styles.settingsBox}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                   <h4 style={{ margin: 0, color: 'var(--primary)', textTransform: 'capitalize' }}>{tierId} Plan</h4>
                                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                     <span style={{ fontWeight: 600 }}>₦</span>
                                     <input 
                                       type="number" 
                                       className="form-input" 
                                       style={{ width: '100px' }} 
                                       value={planConfig.price || ''}
                                       placeholder="Price"
                                       onChange={(e) => {
                                          const next = { ...uniConfig, plans: { ...uniConfig.plans, [tierId]: { ...planConfig, price: e.target.value } } };
                                          setUniConfig(next);
                                       }}
                                     />
                                   </div>
                                </div>
                                
                                <div style={{ marginTop: '1rem' }}>
                                   <label className={styles.subText}>Upload Credits (1 credit = 1 product upload)</label>
                                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                                      <input
                                        type="number"
                                        className="form-input"
                                        style={{ width: '120px', height: '32px' }}
                                        value={planConfig.upload_credits ?? ''}
                                        placeholder="e.g. 20"
                                        onChange={(e) => {
                                           const next = { ...uniConfig, plans: { ...uniConfig.plans, [tierId]: { ...planConfig, upload_credits: Number(e.target.value) } } };
                                           setUniConfig(next);
                                        }}
                                      />
                                      <span className={styles.subText} style={{ fontSize: '0.75rem' }}>per cycle</span>
                                   </div>
                                   <label className={styles.subText} style={{ marginTop: '0.75rem', display: 'block' }}>Additional Features</label>
                                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                                      {[
                                        { id: 'reels_upload', label: 'Reels Upload' },
                                        { id: 'priority_support', label: 'Priority Support' },
                                        { id: 'analytics_pro', label: 'Adv. Analytics' },
                                        { id: 'verified_badge', label: 'Verified Badge' },
                                        { id: 'store_customization', label: 'Store Customization' },
                                        { id: 'featured_placement', label: 'Featured Placement' },
                                        { id: 'promo_codes', label: 'Promo Codes' },
                                        { id: 'bulk_upload', label: 'Bulk Upload' }
                                      ].map(feat => (
                                        <label key={feat.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                                           <input
                                             type="checkbox"
                                             checked={(planConfig.features || []).includes(feat.id)}
                                             onChange={(e) => {
                                                const currentFeats = planConfig.features || [];
                                                const nextFeats = e.target.checked ? [...currentFeats, feat.id] : currentFeats.filter((f: string) => f !== feat.id);
                                                const next = { ...uniConfig, plans: { ...uniConfig.plans, [tierId]: { ...planConfig, features: nextFeats } } };
                                                setUniConfig(next);
                                             }}
                                           />
                                           {feat.label}
                                        </label>
                                      ))}
                                   </div>
                                </div>
                                <button className="btn btn-primary btn-sm w-full mt-3" onClick={() => {
                                   adminAction('update_uni_config', { universityId: selectedUniId, key: 'plans', value: uniConfig.plans });
                                }}>Save Plan</button>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Booster Plans Override */}
                      <div>
                        <h3>Visibility Booster Plans (Product Boosters)</h3>
                        <p className={styles.subText}>Configure fixed prices for the 3 official booster tiers on this campus.</p>
                        <div className={styles.settingsGrid} style={{ marginTop: '1.5rem', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                           {[
                             { id: 'rodeo', name: 'RODEO BOOSTER', visibility: 50, color: '#3b82f6' },
                             { id: 'nitro', name: 'NITRO BOOSTER', visibility: 150, color: '#a855f7' },
                             { id: 'apex', name: 'APEX BOOSTER', visibility: 500, color: '#ef4444' }
                           ].map(boost => {
                             const boostConfig = (uniConfig.boosters || {})[boost.id] || { price: 0 };
                             return (
                               <div key={boost.id} className={styles.settingsBox} style={{ borderLeft: `4px solid ${boost.color}` }}>
                                 <div style={{ fontWeight: 700, fontSize: '0.9rem', color: boost.color }}>{boost.name}</div>
                                 <div className={styles.subText} style={{ fontSize: '0.75rem', marginBottom: '1rem' }}>Visibility Score: +{boost.visibility}</div>
                                 
                                 <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                   <span style={{ fontWeight: 600 }}>₦</span>
                                   <input 
                                     type="number" 
                                     className="form-input" 
                                     placeholder="Price" 
                                     value={boostConfig.price || ''}
                                     onChange={(e) => {
                                        const nextBoosters = { ...uniConfig.boosters, [boost.id]: { price: Number(e.target.value), visibility: boost.visibility } };
                                        setUniConfig({ ...uniConfig, boosters: nextBoosters });
                                     }}
                                   />
                                 </div>
                                 <button className="btn btn-primary btn-sm w-full mt-3" onClick={() => adminAction('update_uni_config', { universityId: selectedUniId, key: 'boosters', value: uniConfig.boosters })}>Save Booster</button>
                               </div>
                             );
                           })}
                        </div>

                        <div style={{ marginTop: '2rem' }} className={styles.settingsBox}>
                          <h3>Campus Billboard (Main Slider)</h3>
                          <p className={styles.subText}>Main homepage promotional banner cost.</p>
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', maxWidth: '300px' }}>
                            <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center' }}>₦</span>
                            <input 
                              type="number" 
                              className="form-input" 
                              value={uniConfig.billboard_price || ''} 
                              onChange={(e) => setUniConfig({ ...uniConfig, billboard_price: Number(e.target.value) })}
                            />
                            <button className="btn btn-primary btn-sm" onClick={() => adminAction('update_uni_config', { universityId: selectedUniId, key: 'billboard_price', value: uniConfig.billboard_price })}>Save</button>
                          </div>
                        </div>
                      </div>

                    </div>
                  )}
                  
                  {!selectedUniId && (
                    <div style={{ marginTop: '2rem', padding: '2rem', textAlign: 'center', background: 'var(--bg-200)', borderRadius: '12px', border: '1px dashed var(--border)' }}>
                      <Settings size={32} color="var(--text-400)" style={{ margin: '0 auto 1rem' }} />
                      <p style={{ color: 'var(--text-300)' }}>Select a university from the dropdown above to view and configure its settings.</p>
                    </div>
                  )}
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
                              {uniTeams.map((m: any) => (
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

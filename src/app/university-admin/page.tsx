/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import styles from "./university-admin.module.css";
import {
  LayoutDashboard, Store, Users, ShoppingCart, Star, Bell,
  BarChart3, Globe, Truck, Shield, LogOut, RefreshCw, Search,
  CheckCircle, XCircle, Loader2, AlertTriangle, Plus, UserPlus, Trash2, Tag, Settings, ShoppingBag, Coffee,
  ShieldCheck, CreditCard, FolderOpen, Clock, Edit2
} from "lucide-react";
import PremiumChart from "@/components/PremiumChart"; 
import { uploadFile } from "@/lib/storage";

type Tab = "overview" | "vendors" | "customers" | "orders" | "reviews" | "notices" | "analytics" | "insights" | "fleet" | "team" | "catalog" | "merchandising" | "settings" | "promos" | "cafeterias" | "manual_transfers" | "categories";

async function uaFetch(path: string, opts: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  return fetch(path, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}`, ...(opts.headers||{}) },
  });
}

export default function UniversityAdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string|null>(null);
  const [myUniversity, setMyUniversity] = useState<any>(null);
  const [userCtx, setUserCtx] = useState<any>(null);
  const fetchedRef = useRef(false);

  const [stats, setStats] = useState<any>({});
  const [vendors, setVendors] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [deletedUsers, setDeletedUsers] = useState<any[]>([]);
  const [customersSubTab, setCustomersSubTab] = useState<'all' | 'deleted'>('all');
  const [orders, setOrders] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [riders, setRiders] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [cafeterias, setCafeterias] = useState<any[]>([]);
  const [showCafeteriaModal, setShowCafeteriaModal] = useState(false);
  const [cafeteriaForm, setCafeteriaForm] = useState({ id: "", name: "", description: "", is_active: true });

  // Manual Transfers state
  const [manualOrders, setManualOrders] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [manualQueueSubTab, setManualQueueSubTab] = useState<'pending' | 'history'>('pending');
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankForm, setBankForm] = useState({ id: '', bank_name: '', bank_code: '', account_number: '', account_name: '', label: 'Main Account' });
  const [availableBanks, setAvailableBanks] = useState<any[]>([]);
  const [resolvingBank, setResolvingBank] = useState(false);

  // Categories state
  const [categories, setCategories] = useState<any[]>([]);
  const [categorySubTab, setCategorySubTab] = useState<'edible' | 'non_edible'>('edible');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ id: '', name: '', type: 'edible', icon: '📦', is_active: true, sort_order: 0 });
  const [staffSearch, setStaffSearch] = useState("");
  const [platformSettings, setPlatformSettings] = useState<any>({});

  useEffect(() => {
    const handleMilesTourActivation = (event: Event) => {
      const detail = (event as CustomEvent<{ route?: string; tab?: string }>).detail;
      if (detail?.route === '/university-admin' && detail.tab) setTab(detail.tab as Tab);
    };
    window.addEventListener('mastercart:miles-tour-activate', handleMilesTourActivation);
    return () => window.removeEventListener('mastercart:miles-tour-activate', handleMilesTourActivation);
  }, []);

  const [notifForm, setNotifForm] = useState({ title:"", content:"", target:"all" });
  const [notifSending, setNotifSending] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [staffForm, setStaffForm] = useState({ userId:"", staffRole:"university_staff", permissions:[] as string[] });
  const [addStaffLoading, setAddStaffLoading] = useState(false);
  const [orderFilter, setOrderFilter] = useState("all");
  const [homepageSections, setHomepageSections] = useState<any[]>([]);
  const [promoCodes, setPromoCodes] = useState<any[]>([]);
  const [promoForm, setPromoForm] = useState({ code: '', type: 'fixed', value: '', max_uses: '100', product_id: '', subsidiary_capital: '' });
  const [sectionForm, setSectionForm] = useState<any>({ title: '', type: 'manual', layout_type: 'horizontal_scroll', is_active: true, priority: 0, auto_rule: { criteria: 'limited_stock', threshold: 5, limit: 12 } });
  const [editingSection, setEditingSection] = useState<any>(null);

  const [billboardUpload, setBillboardUpload] = useState({ title: '', sub: '', link: '', file: null as File|null });
  const [uploadingBillboard, setUploadingBillboard] = useState(false);

  const handleBillboardUpload = async () => {
    if (!billboardUpload.file || !billboardUpload.title) return alert('Image and Title required');
    setUploadingBillboard(true);
    try {
      const { url, error: uploadError } = await uploadFile(
        billboardUpload.file,
        'brand-assets',
        'manual_billboards/billboard'
      );
      if (!url) throw new Error(uploadError || 'Billboard upload failed');
      
      const res = await uaFetch("/api/university-admin", { 
        method: "POST", 
        body: JSON.stringify({ 
          action: "add_manual_billboard", 
          title: billboardUpload.title,
          description: billboardUpload.sub,
          link: billboardUpload.link,
          cover_url: url
        }) 
      });
      const d = await res.json();
      if (d.success) {
        setBillboardUpload({ title: '', sub: '', link: '', file: null });
        alert('Billboard added successfully! It will now show on your students\' homepage.');
      } else alert(d.error||"Action failed");
    } catch(e:any) { alert(e.message); }
    setUploadingBillboard(false);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/auth/login"); return; }
      const { data: profile } = await supabase.from("users").select("*, universities:universities!users_university_id_fkey(*)").eq("id", session.user.id).single();
      if (profile) {
        // Redirect support agents to their dedicated dashboard
        if (profile.role === 'customer_support_agent') {
          router.replace('/dashboard/support');
          return;
        }
        setUserCtx(profile);
        setMyUniversity(profile.universities);
        
        // Fetch latest university config
        try {
          const configRes = await uaFetch(`/api/university-admin?action=university_config&uniId=${profile.university_id}`);
          if (configRes.ok) {
            const { config } = await configRes.json();
            setPlatformSettings(config || {});
          } else if (profile.universities?.config) {
            setPlatformSettings(profile.universities.config);
          }
        } catch {
          if (profile.universities?.config) setPlatformSettings(profile.universities.config);
        }
      }
    };
    init();
  }, [router]);

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const actions = ["stats","vendors","customers","orders","reviews","riders","analytics","cross_university_insights","team","products", "merchandising", "promo_codes", "deleted_users", "cafeterias", "manual_payments", "bank_accounts", "categories"];
      const results = await Promise.allSettled(actions.map(async a => {
        const r = await uaFetch(`/api/university-admin?action=${a}`);
        if (!r.ok) {
          const err = await r.json();
          throw new Error(err.error || `Failed to fetch ${a}`);
        }
        return r.json();
      }));
      
      const g = (i: number) => results[i].status === "fulfilled" ? (results[i] as any).value : {};
      const errs = results.filter(r => r.status === "rejected").map(r => (r as any).reason.message);
      if (errs.length > 0) setError(`Some data failed to load: ${errs.join(", ")}`);

      setStats(g(0).stats||{});
      setVendors(g(1).vendors||[]);
      setCustomers(g(2).customers||[]);
      setOrders(g(3).orders||[]);
      setReviews(g(4).reviews||[]);
      setRiders(g(5).riders||[]);
      setChartData(g(6).chartData||[]);
      setTeam(g(8).team||[]);
      setProducts(g(9).products||[]);
      setHomepageSections(g(10).sections||[]);
      setPromoCodes(g(11).promoCodes||[]);
      setDeletedUsers(g(12).deletedUsers||[]);
      setCafeterias(g(13).cafeterias||[]);
      setManualOrders(g(14).orders||[]);
      setBankAccounts(g(15).bankAccounts||[]);
      setCategories(g(16).categories||[]);

      // Identify most volatile university (example logic: highest growth or activity)
      const insightsData = g(7).insights || [];
      if (insightsData.length > 0) {
        // Sort by orders or revenue to find the 'hottest'
        const sorted = [...insightsData].sort((a, b) => Number(b.total_orders || 0) - Number(a.total_orders || 0));
        setInsights(sorted);
      }
    } catch (e: any) { 
      setError(e.message || "Failed to load dashboard data."); 
    }
    setLoading(false);
  }, []);

  useEffect(() => { 
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchAll(); 
  }, [fetchAll]);

  // Load available banks for bank account configuration
  useEffect(() => {
    const loadBanks = async () => {
      try {
        const res = await fetch('/api/paystack/banks');
        const d = await res.json();
        if (d.data) setAvailableBanks(d.data || []);
      } catch { /* silent */ }
    };
    loadBanks();
  }, []);

  // Auto-resolve bank account details for university bank account modal
  useEffect(() => {
    const resolveAccount = async () => {
      if (bankForm.account_number.length === 10 && bankForm.bank_code) {
        setResolvingBank(true);
        setBankForm(prev => ({ ...prev, account_name: '' }));
        try {
          const res = await fetch(`/api/paystack/resolve?accountNumber=${bankForm.account_number}&bankCode=${bankForm.bank_code}`);
          const d = await res.json();
          if (d.success && d.data?.account_name) {
            setBankForm(prev => ({ ...prev, account_name: d.data.account_name }));
          } else {
            alert('Could not resolve bank account details.');
          }
        } catch (err) {
          alert('Error resolving bank account details.');
        }
        setResolvingBank(false);
      }
    };
    resolveAccount();
  }, [bankForm.account_number, bankForm.bank_code]);

  const action = async (act: string, payload: any) => {
    setActionLoading(act+(payload.brandId||payload.userId||""));
    try {
      const res = await uaFetch("/api/university-admin", { method:"POST", body: JSON.stringify({ action: act, ...payload }) });
      const d = await res.json();
      if (d.success) await fetchAll();
      else alert(d.error||"Action failed");
    } catch { alert("Network error"); }
    setActionLoading("");
  };

  const filter = (items: any[], fields: string[]) => {
    if (!search.trim()) return items;
    const term = search.toLowerCase();
    return items.filter(i => {
      const matchesFlat = fields.some(f => String(i[f]||"").toLowerCase().includes(term));
      if (matchesFlat) return true;

      // Handle vendor lists matching owner's name or email nested inside users
      if (i.users) {
        if (String(i.users.name || '').toLowerCase().includes(term)) return true;
        if (String(i.users.email || '').toLowerCase().includes(term)) return true;
      }
      return false;
    });
  };

  const pendingVendors = vendors.filter(v => v.verification_status==="pending");

  const TABS: [Tab, string, any][] = [
    ["overview","Overview",LayoutDashboard],["vendors","Vendors",Store],["cafeterias","Cafeterias",Coffee],["catalog","Catalog",ShoppingCart],["customers","Customers",Users],
    ["orders","Orders",ShoppingCart],["manual_transfers","Manual Transfers",CreditCard],
    ["reviews","Reviews",Star],["notices","Notices",Bell],["merchandising","Merchandising",Tag],
    ["promos","Promo Codes",Tag],["categories","Categories",FolderOpen],
    ["analytics","Analytics",BarChart3],["insights","Insights",Globe],["fleet","Fleet",Truck],["team","My Team",Shield],["settings","Settings",Settings],
  ];

  const hasAccess = (tabId: string) => {
    if (userCtx?.role === "admin" || userCtx?.role === "university_admin") return true;
    if (["overview", "analytics", "insights"].includes(tabId)) return true;
    // Verifying admins can only access the manual transfers tab
    if (tabId === "manual_transfers" && userCtx?.admin_permissions?.includes("verify_payments")) return true;
    return userCtx?.admin_permissions?.includes(tabId);
  };

  const visibleManagement = TABS.slice(0,7).filter(t => hasAccess(t[0]));
  const visibleCommunication = TABS.slice(7,8).filter(t => hasAccess(t[0]));
  const visibleOps = TABS.slice(8).filter(t => hasAccess(t[0]));

  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logoMark}>
            <div className={styles.logoIcon}>📦</div>
            <span className={styles.logoText}>MASTERCART</span>
          </div>
          {myUniversity && <div className={styles.universityBadge}>🏛 {myUniversity.abbreviation||myUniversity.name} ADMIN</div>}
        </div>
        <nav className={styles.nav}>
          <div className={styles.navGroup}>Management</div>
          {visibleManagement.map(([id,label,Icon]) => (
            <button key={id} className={`${styles.navItem} ${tab===id?styles.navActive:""}`} onClick={()=>{setTab(id);setSearch("");}}>
              <Icon size={17}/> {label}
              {id==="vendors"&&pendingVendors.length>0&&<span className={styles.navBadge}>{pendingVendors.length}</span>}
            </button>
          ))}
          <div className={styles.navGroup}>Communication</div>
          {visibleCommunication.map(([id,label,Icon]) => (
            <button key={id} className={`${styles.navItem} ${tab===id?styles.navActive:""}`} onClick={()=>{setTab(id);setSearch("");}}>
              <Icon size={17}/> {label}
            </button>
          ))}
          <div className={styles.navGroup}>Analytics & Ops</div>
          {visibleOps.map(([id,label,Icon]) => (
            <button key={id} className={`${styles.navItem} ${tab===id?styles.navActive:""}`} onClick={()=>{setTab(id);setSearch("");}}>
              <Icon size={17}/> {label}
            </button>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <Link href="/" className={styles.footerLink}>← Marketplace</Link>
          <button className={styles.footerLink} onClick={async()=>{await supabase.auth.signOut();router.push("/");}}>
            <LogOut size={14}/> Sign Out
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <h1>{TABS.find(t=>t[0]===tab)?.[1]}</h1>
            {!loading&&<div className={styles.liveBadge}><span className={styles.liveDot}/>LIVE</div>}
          </div>
          <div className={styles.headerRight}>
            <div className={styles.searchBar}>
              <Search size={15}/>
              <input placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <button className={styles.refreshBtn} onClick={fetchAll}><RefreshCw size={16} className={loading?styles.spin:""}/></button>
          </div>
        </header>

        <div className={styles.content}>
          {error&&<div className={styles.errorBox}><AlertTriangle size={16}/>{error}</div>}
          {loading ? (
            <div className={styles.loading}><Loader2 size={28} className={styles.spin}/> Loading...</div>
          ) : (
            <>
              {tab==="overview"&&(
                <>
                  {vendors.filter((v: any) => v.verification_status === "pending").length > 0 && (
                    <div style={{
                      background: '#121214',
                      border: '1px solid #A0A0A0',
                      borderRadius: '12px',
                      padding: '1.25rem',
                      marginBottom: '1.5rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '1rem',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                          background: '#121214',
                          color: '#000000',
                          borderRadius: '50%',
                          width: '40px',
                          height: '40px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '1.2rem',
                        }}>
                          ⚠️
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: '#FFFFFF' }}>
                            Pending Vendor Verifications ({vendors.filter((v: any) => v.verification_status === "pending").length})
                          </h4>
                          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', opacity: 0.8, color: '#FFFFFF' }}>
                            There are currently {vendors.filter((v: any) => v.verification_status === "pending").length} brand applications waiting for university verification. Review and approve them.
                          </p>
                        </div>
                      </div>
                      <button 
                        className={styles.btnSm}
                        style={{ background: '#121214', color: '#000000', border: 'none', fontWeight: 600, padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}
                        onClick={() => setTab('vendors')}
                      >
                        Review Now
                      </button>
                    </div>
                  )}
                  <div className={styles.statsGrid} id="tour-uni-admin-overview" data-miles-tour="university-admin-overview">
                    {[
                      {label:"Vendors",val:stats.totalVendors||0,color:"#000000",bg:"rgba(0,0,0,0.1)"},
                      {label:"Customers",val:stats.totalUsers||0,color:"#000000",bg:"rgba(0,0,0,0.1)"},
                      {label:"Total Orders",val:stats.totalOrders||0,color:"#FFFFFF",bg:"rgba(255,255,255,0.1)"},
                      {label:"Total Revenue (Paid)",val:`₦${(stats.totalRevenue||0).toLocaleString()}`,color:"#FFFFFF",bg:"rgba(255,255,255,0.1)"},
                      {label:"Acquired Revenue (Completed)",val:`₦${(stats.acquiredRevenue||0).toLocaleString()}`,color:"#FFFFFF",bg:"rgba(255,255,255,0.1)"},
                      {label:"Projected Revenue (Stock Value)",val:`₦${(stats.projectedRevenue||0).toLocaleString()}`,color:"#FFFFFF",bg:"rgba(255,255,255,0.1)"},
                    ].map(({label,val,color,bg})=>(
                      <div key={label} className={styles.statCard}>
                        <div><div className={styles.statLabel}>{label}</div><div className={styles.statValue}>{val}</div></div>
                        <div className={styles.statIcon} style={{background:bg,color}}><BarChart3 size={20}/></div>
                      </div>
                    ))}
                  </div>
                  {stats.popularProducts?.length>0&&(
                    <div className={styles.sectionCard} style={{marginTop:"1.5rem"}}>
                      <div className={styles.sectionHeader}><div><h2>Top Products</h2><p>Most sold in your university</p></div></div>
                      <div className={styles.tableWrap}>
                        <table className={styles.table}>
                          <thead><tr><th>#</th><th>Product</th><th>Sales</th><th>Views</th></tr></thead>
                          <tbody>{(stats.popularProducts as any[]).map((p:any,i:number)=>(
                            <tr key={p.id}><td className={styles.subText}>{i+1}</td><td>{p.title}</td><td style={{color:"#FFFFFF",fontWeight:700}}>{p.sales_count||0}</td><td className={styles.subText}>{p.views_count||0}</td></tr>
                          ))}</tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}

              {tab==="vendors"&&(
                <div className={styles.sectionCard} id="tour-uni-admin-vendors" data-miles-tour="university-admin-vendors">
                  <div className={styles.sectionHeader}><div><h2>Vendor Management</h2><p>Approve, reject, and monitor vendors in your university</p></div></div>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead><tr><th>Brand</th><th>Owner</th><th>Status</th><th>Tier</th><th>Actions</th></tr></thead>
                      <tbody>
                        {filter(vendors,["name","matric_number"]).map((v:any)=>(
                          <tr key={v.id}>
                            <td><div className={styles.avatarCell}><div className={styles.avatar}>{v.name?.substring(0,2).toUpperCase()}</div><div><div style={{fontWeight:600}}>{v.name}</div></div></div></td>
                             <td><div>{v.users?.name || 'N/A'}</div><div className={styles.subText}>{v.users?.email}</div></td>
                            <td><span className={`${styles.badge} ${styles["badge"+v.verification_status?.charAt(0).toUpperCase()+v.verification_status?.slice(1)]||styles.badgePending}`}>{v.verification_status}</span></td>
                            <td><span style={{fontSize:"0.75rem",color:"#FFFFFF"}}>{v.subscription_tier||"free"}</span></td>
                            <td>
                              <div className={styles.actionRow}>
                                {v.verification_status!=="verified"&&<button className={`${styles.btnSm} ${styles.btnApprove}`} onClick={()=>action("verify_vendor",{brandId:v.id})} disabled={!!actionLoading} title="Verify Vendor"><CheckCircle size={13}/></button>}
                                {v.verification_status!=="rejected"&&<button className={`${styles.btnSm} ${styles.btnReject}`} onClick={()=>{const r=prompt("Rejection reason:");if(r)action("reject_vendor",{brandId:v.id,reason:r});}} disabled={!!actionLoading} title="Reject Vendor"><XCircle size={13}/></button>}
                                <button className={`${styles.btnSm} ${styles.btnDelete}`} onClick={()=>{if(confirm("Delete vendor? This is permanent.")) action("delete_vendor",{brandId:v.id});}} title="Delete Vendor"><Trash2 size={13}/></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tab==="customers"&&(
                <div className={styles.sectionCard}>
                  <div className={styles.sectionHeader} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                    <div>
                      <h2>Customers & Recycle Bin</h2>
                      <p>Manage users and restore soft-deleted profiles in your university</p>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                    <button 
                      className={`${styles.btnSm} ${customersSubTab === 'all' ? styles.btnApprove : styles.btnReject}`}
                      style={{ background: customersSubTab === 'all' ? 'var(--primary)' : '#121214', color: '#FFFFFF', border: '1px solid var(--border)' }}
                      onClick={() => setCustomersSubTab('all')}
                    >
                      Active Users ({filter(customers, ["name", "email", "display_name"]).length})
                    </button>
                    <button 
                      className={`${styles.btnSm} ${customersSubTab === 'deleted' ? styles.btnApprove : styles.btnReject}`}
                      style={{ background: customersSubTab === 'deleted' ? 'var(--primary)' : '#121214', color: '#FFFFFF', border: '1px solid var(--border)', position: 'relative' }}
                      onClick={() => setCustomersSubTab('deleted')}
                    >
                      Recycle Bin ({filter(deletedUsers, ["name", "email"]).length})
                      {deletedUsers.length > 0 && (
                        <span style={{
                          background: '#000000',
                          color: '#FFFFFF',
                          borderRadius: '10px',
                          padding: '2px 6px',
                          fontSize: '10px',
                          fontWeight: 700,
                          marginLeft: '6px'
                        }}>
                          {deletedUsers.length}
                        </span>
                      )}
                    </button>
                  </div>

                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        {customersSubTab === 'deleted' ? (
                          <tr><th>Deleted User</th><th>Role</th><th>Deletion Info</th><th>Actions</th></tr>
                        ) : (
                          <tr><th>Customer</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr>
                        )}
                      </thead>
                      <tbody>
                        {customersSubTab === 'deleted' ? (
                          filter(deletedUsers, ["name", "email"]).map((c: any) => (
                            <tr key={c.id}>
                              <td>
                                <div style={{ fontWeight: 600 }}>{c.name || '—'}</div>
                                <div className={styles.subText}>{c.email}</div>
                              </td>
                              <td><span className={styles.badge}>{c.role}</span></td>
                              <td>
                                <div style={{ fontSize: '0.75rem', color: '#000000', fontWeight: 600 }}>
                                  🗓️ {c.deleted_at ? new Date(c.deleted_at).toLocaleString() : 'N/A'}
                                </div>
                                {c.deleted_reason && (
                                  <div className={styles.subText} style={{ fontStyle: 'italic', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.deleted_reason}>
                                    Reason: {c.deleted_reason}
                                  </div>
                                )}
                              </td>
                              <td>
                                <div className={styles.actionRow} style={{ gap: '0.5rem' }}>
                                  <button 
                                    className={styles.btnSm} 
                                    style={{ background: '#121214', color: '#000000', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '4px 10px' }}
                                    onClick={() => { if (confirm('Restore this user account?')) action('restore_user', { userId: c.id }) }}
                                  >
                                    Restore
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          filter(customers, ["name", "email", "display_name"]).map((c: any) => (
                            <tr key={c.id}>
                              <td>
                                <div style={{ fontWeight: 600 }}>{c.display_name || c.name || c.email?.split('@')[0]}</div>
                                <div className={styles.subText}>{c.email}</div>
                              </td>
                              <td><span className={styles.badge}>{c.role}</span></td>
                              <td><span className={c.status === "active" ? styles.badgeActive : styles.badgeOffline}>{c.status || "active"}</span></td>
                              <td>{new Date(c.created_at).toLocaleDateString()}</td>
                              <td>
                                <div className={styles.actionRow} style={{ gap: '0.5rem' }}>
                                  <button 
                                    className={styles.btnSm} 
                                    style={{ background: '#121214', border: '1px solid var(--border)' }}
                                    onClick={() => action("toggle_user_status", { userId: c.id, status: c.status === "active" ? "suspended" : "active" })}
                                  >
                                    {c.status === "active" ? "Suspend" : "Activate"}
                                  </button>
                                  <button 
                                    className={styles.btnSm} 
                                    style={{ background: '#000000', color: '#FFFFFF', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    onClick={() => {
                                      const reason = prompt('Reason for soft-deleting this user:');
                                      if (reason !== null) {
                                        action('delete_user', { userId: c.id, reason });
                                      }
                                    }}
                                    title="Move to Recycle Bin"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tab==="orders"&&(
                <div className={styles.sectionCard}>
                  <div className={styles.sectionHeader}><div><h2>Orders</h2><p>All orders within your university</p></div></div>
                  <div className={styles.filterBar}>
                    {["all","paid","pending","cancelled"].map(f=>(
                      <button key={f} className={`${styles.filterBtn} ${orderFilter===f?styles.filterActive:""}`} onClick={()=>setOrderFilter(f)}>{f.toUpperCase()}</button>
                    ))}
                  </div>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead><tr><th>Order</th><th>Customer</th><th>Brand</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
                      <tbody>
                        {orders.filter(o=>orderFilter==="all"||o.status===orderFilter).map((o:any)=>(
                          <tr key={o.id}>
                            <td className={styles.subText}>#{o.id.slice(0,8)}</td>
                            <td>{o.users?.name || o.users?.email?.split('@')[0] || "—"}</td>
                            <td>{o.brands?.name||"—"}</td>
                            <td style={{fontWeight:700,color:"#FFFFFF"}}>₦{Number(o.total_amount).toLocaleString()}</td>
                            <td><span className={`${styles.badge} ${o.status==="paid"?styles.badgePaid:o.status==="cancelled"?styles.badgeCancelled:styles.badgePending}`}>{o.status}</span></td>
                            <td className={styles.subText}>{new Date(o.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tab==="reviews"&&(
                <div className={styles.sectionCard}>
                  <div className={styles.sectionHeader}><div><h2>Reviews</h2><p>Product and vendor reviews in your university</p></div></div>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead><tr><th>User</th><th>Product</th><th>Rating</th><th>Comment</th><th>Date</th></tr></thead>
                      <tbody>
                        {filter(reviews,["comment"]).map((r:any)=>(
                          <tr key={r.id}>
                            <td>{r.users?.name || r.users?.email?.split('@')[0] || "—"}</td>
                             <td className={styles.subText}>
                               <div style={{fontWeight:600}}>{r.products?.title || r.brands?.name || "—"}</div>
                               {r.products?.description && <div className={styles.subText} style={{fontSize:'0.7rem', maxWidth:'200px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{r.products.description}</div>}
                             </td>
                            <td style={{color:"#FFFFFF",fontWeight:700}}>{"★".repeat(r.rating)}</td>
                            <td>{r.comment||"—"}</td>
                            <td className={styles.subText}>{new Date(r.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tab==="notices"&&(
                <>
                <div className={styles.sectionCard}>
                  <div className={styles.sectionHeader}><div><h2>Broadcast Notices</h2><p>Send announcements to your university community</p></div></div>
                  <div className={styles.notifForm}>
                    <div>
                      <label className={styles.formLabel}>Target Audience</label>
                      <select className={styles.formSelect} value={notifForm.target} onChange={e=>setNotifForm({...notifForm,target:e.target.value})}>
                        <option value="all">Everyone in University</option>
                        <option value="vendors">Vendors Only</option>
                        <option value="customers">Customers Only</option>
                        <option value="riders">Riders Only</option>
                      </select>
                    </div>
                    <div>
                      <label className={styles.formLabel}>Title</label>
                      <input className={styles.formInput} placeholder="Notification title..." value={notifForm.title} onChange={e=>setNotifForm({...notifForm,title:e.target.value})}/>
                    </div>
                    <div>
                      <label className={styles.formLabel}>Message</label>
                      <textarea className={styles.formInput} rows={4} placeholder="Your message..." value={notifForm.content} onChange={e=>setNotifForm({...notifForm,content:e.target.value})}/>
                    </div>
                    <button className={styles.btnPrimary} disabled={notifSending||!notifForm.title||!notifForm.content} onClick={async()=>{
                      setNotifSending(true);
                      await action("send_notification",notifForm);
                      setNotifForm({title:"",content:"",target:"all"});
                      setNotifSending(false);
                    }}>
                      {notifSending?<><Loader2 size={15} className={styles.spin}/>Sending...</>:<><Bell size={15}/>Send Broadcast</>}
                    </button>
                  </div>
                </div>

                <div className={styles.sectionCard} style={{ marginTop: '2rem' }} id="tour-uni-admin-notices" data-miles-tour="university-admin-notices">
                  <div className={styles.sectionHeader}><div><h2>Manual Homepage Billboard</h2><p>Feature a custom promotional banner for your students</p></div></div>
                  <div className={styles.notifForm}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', width: '100%' }}>
                       <div>
                          <label className={styles.formLabel}>Banner Title</label>
                          <input 
                            className={styles.formInput}
                            placeholder="e.g. Summer Mega Sale" 
                            value={billboardUpload.title}
                            onChange={e => setBillboardUpload({...billboardUpload, title: e.target.value})}
                          />
                       </div>
                       <div>
                          <label className={styles.formLabel}>Description</label>
                          <input 
                            className={styles.formInput}
                            placeholder="e.g. Up to 50% off all items" 
                            value={billboardUpload.sub}
                            onChange={e => setBillboardUpload({...billboardUpload, sub: e.target.value})}
                          />
                       </div>
                       <div>
                          <label className={styles.formLabel}>Click Link (Optional)</label>
                          <input 
                            className={styles.formInput}
                            placeholder="e.g. /explore?cat=sale" 
                            value={billboardUpload.link}
                            onChange={e => setBillboardUpload({...billboardUpload, link: e.target.value})}
                          />
                       </div>
                       <div>
                          <label className={styles.formLabel}>Banner Image</label>
                          <input 
                            type="file"
                            accept="image/*"
                            className={styles.formInput}
                            onChange={e => setBillboardUpload({...billboardUpload, file: e.target.files?.[0] || null})}
                          />
                       </div>
                    </div>
                    
                    <button 
                      className={styles.btnPrimary}
                      style={{ marginTop: '1.5rem', minWidth: '200px' }}
                      disabled={uploadingBillboard}
                      onClick={handleBillboardUpload}
                    >
                       {uploadingBillboard ? <Loader2 size={18} className={styles.spin} /> : <><Plus size={15}/> Upload Billboard 🚀</>}
                    </button>
                  </div>
                </div>
                </>
              )}

              {tab==="analytics"&&(
                <div className={styles.sectionCard}>
                  <div className={styles.sectionHeader}><div><h2>University Analytics</h2><p>Live transaction and revenue tracking for your campus</p></div></div>
                  <div style={{padding:"1.5rem"}}>
                    <PremiumChart 
                      title="University Financial Breakdown"
                      subtitle="Projected, Realized & Unrealized Revenue for your campus"
                      realtimeConfig={{
                        table: 'orders',
                        filter: { university_id: myUniversity?.id }
                      }}
                      multiLineConfig={{
                        keys: [
                          { dataKey: 'projected', color: '#FFFFFF', label: 'Campus Projected', isProjected: true },
                          { dataKey: 'realized', color: '#000000', label: 'Campus Realized' },
                          { dataKey: 'unrealized', color: '#FFFFFF', label: 'Campus Unrealized' },
                          { dataKey: 'failed', color: '#000000', label: 'Campus Failed' }
                        ],
                        categorize: (row: Record<string, any>) => {
                          const val = Number(row.total_amount || 0);
                          const status = row.status || 'pending';
                          const res = [{ dataKey: 'projected', value: val }];
                          if (status === 'completed' || status === 'confirmed') res.push({ dataKey: 'realized', value: val });
                          else if (status === 'paid' || status === 'ready' || status === 'in_transit' || status === 'picked_up') res.push({ dataKey: 'unrealized', value: val });
                          else if (status === 'cancelled' || status === 'failed') res.push({ dataKey: 'failed', value: val });
                          return res;
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              {tab === "promos" && (
                <div className={styles.sectionCard}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <h2>Campus Promo Codes</h2>
                      <p>Create and manage discount codes for your university students.</p>
                    </div>
                    <button className={styles.btnPrimary} onClick={() => (document.getElementById('promo-modal') as any)?.showModal()}>
                      <Plus size={15} /> New Promo Code
                    </button>
                  </div>

                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Value</th>
                          <th>Uses</th>
                          <th>Scope</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {promoCodes.map(p => (
                          <tr key={p.id}>
                            <td><div style={{ fontWeight: 800, color: 'var(--primary)', letterSpacing: '0.05em' }}>{p.code}</div></td>
                            <td>{p.type === 'percentage' ? `${p.value}% Off` : `₦${p.value} Off`}</td>
                            <td>{p.used_count || 0} / {p.max_uses}</td>
                            <td>{p.product_id ? <span className={styles.subText}>{p.products?.title}</span> : 'Entire Catalog'}</td>
                            <td>
                              <span className={p.is_active ? styles.textGreen : styles.textRed}>{p.is_active ? 'Active' : 'Inactive'}</span>
                              {p.subsidiary_capital > 0 && (
                                <div style={{ fontSize: '0.65rem', color: '#FFFFFF', marginTop: '2px' }}>
                                  Budget: ₦{Number(p.capital_used || 0).toLocaleString()} / ₦{Number(p.subsidiary_capital).toLocaleString()}
                                </div>
                              )}
                            </td>
                            <td>
                              <button className={`${styles.btnSm} ${styles.btnReject}`} onClick={() => confirm('Delete promo code?') && action('delete_promo_code', { codeId: p.id })}>
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {promoCodes.length === 0 && (
                          <tr><td colSpan={6} style={{ textAlign: 'center' }} className={styles.subText}>No campus promo codes yet.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Promo Code Modal */}
                  <dialog id="promo-modal" className={styles.modalDialog} style={{ padding: 0 }}>
                    <div className={styles.modalContent} style={{ maxWidth: '400px', background: 'var(--bg-100)', color: '#FFFFFF', borderRadius: '12px', border: '1px solid var(--border)' }}>
                      <div className={styles.modalHeader} style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0 }}>New Promo Code</h3>
                        <button className={styles.btnIcon} onClick={() => (document.getElementById('promo-modal') as any)?.close()}><XCircle size={20} /></button>
                      </div>
                      <div style={{ padding: '1.5rem' }}>
                        <div className="form-group mb-4">
                          <label className={styles.formLabel}>Discount Code</label>
                          <input className={styles.formInput} value={promoForm.code} onChange={e => setPromoForm({...promoForm, code: e.target.value.toUpperCase()})} placeholder="e.g. CAMPUS50" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                          <div>
                            <label className={styles.formLabel}>Type</label>
                            <select className={styles.formInput} value={promoForm.type} onChange={e => setPromoForm({...promoForm, type: e.target.value})}>
                              <option value="fixed">Fixed (₦)</option>
                              <option value="percentage">Percentage (%)</option>
                            </select>
                          </div>
                          <div>
                            <label className={styles.formLabel}>Value</label>
                            <input type="number" className={styles.formInput} value={promoForm.value} onChange={e => setPromoForm({...promoForm, value: e.target.value})} placeholder="10" />
                          </div>
                        </div>
                        <div className="form-group mb-4">
                          <label className={styles.formLabel}>Max Uses</label>
                          <input type="number" className={styles.formInput} value={promoForm.max_uses} onChange={e => setPromoForm({...promoForm, max_uses: e.target.value})} />
                        </div>
                        <div className="form-group mb-4">
                          <label className={styles.formLabel} style={{ color: '#FFFFFF' }}>Subsidiary Capital / Budget (₦)</label>
                          <input 
                             type="number" 
                             className={styles.formInput} 
                             placeholder="Optional budget limit" 
                             value={promoForm.subsidiary_capital || ''} 
                             onChange={e => setPromoForm({...promoForm, subsidiary_capital: e.target.value})} 
                          />
                          <p style={{ fontSize: '0.65rem', color: 'var(--text-400)', marginTop: '4px' }}>Promo ends when this budget is exhausted. Leave blank for unlimited.</p>
                        </div>
                        <button className={styles.btnPrimary} style={{ width: '100%' }} onClick={async () => {
                          await action('create_promo_code', promoForm);
                          setPromoForm({ code: '', type: 'fixed', value: '', max_uses: '100', product_id: '', subsidiary_capital: '' });
                          (document.getElementById('promo-modal') as any)?.close();
                        }}>
                          Create Code
                        </button>
                      </div>
                    </div>
                  </dialog>
                </div>
              )}

              {tab==="insights"&&(
                <div className={styles.sectionCard}>
                  <div className={styles.sectionHeader}><div><h2>Cross-University Insights</h2><p>Read-only comparison across all universities</p></div></div>
                  <div className={styles.insightGrid}>
                    {insights.map((u:any, i:number)=>(
                      <div key={u.university_id} className={`${styles.insightCard} ${u.university_id===myUniversity?.id?styles.myUniversity:""}`}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div className={styles.insightName}>{u.university_name}</div>
                            <div className={styles.insightAbbr}>{u.abbreviation}</div>
                          </div>
                          {i === 0 && (
                            <span className={styles.badge} style={{ background: '#121214', color: '#FFFFFF', fontSize: '0.65rem', fontWeight: 800 }}>
                              🔥 MOST VOLATILE
                            </span>
                          )}
                        </div>
                        {[["Users",u.total_users],["Vendors",u.total_vendors],["Orders",u.total_orders],["Revenue",u.total_revenue===null?"Restricted":u.total_revenue===0?"₦0":`₦${Number(u.total_revenue).toLocaleString()}`]].map(([k,v])=>(
                          <div key={k as string} className={styles.insightRow}>
                            <span>{k}</span>
                            <span className={v==="Restricted"?styles.redacted:""}>{v}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tab==="fleet"&&(
                <div className={styles.sectionCard}>
                  <div className={styles.sectionHeader}><div><h2>Delivery Fleet</h2><p>Riders assigned to your university</p></div></div>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead><tr><th>Rider</th><th>Contact</th><th>Status</th><th>Deliveries</th><th>Balance</th><th>Actions</th></tr></thead>
                      <tbody>
                        {riders.map((r:any)=>(
                           <tr key={r.id}>
                             <td><div style={{fontWeight:600}}>{r.name}</div><div className={styles.subText}>{r.email}</div></td>
                             <td className={styles.subText}>{r.phone||'N/A'}</td>
                             <td>
                               <span className={`${styles.badge} ${r.is_active?styles.badgeActive:styles.badgeOffline}`}>{r.is_active?"Active":"Inactive"}</span>
                             </td>
                             <td>{r.completed_orders_count||0} Deliveries</td>
                             <td style={{color:"#FFFFFF",fontWeight:700}}>₦{Number(r.wallet_balance||0).toLocaleString()}</td>
                             <td>
                               <div className={styles.actionRow}>
                                 {!r.is_active && <button className={`${styles.btnSm} ${styles.btnApprove}`} onClick={()=>action("verify_rider",{userId:r.id})}><CheckCircle size={12}/> Verify</button>}
                                 {r.is_active && <button className={`${styles.btnSm} ${styles.btnReject}`} onClick={()=>{if(confirm('Revoke rider access?'))action("revoke_rider",{userId:r.id});}}><XCircle size={12}/> Revoke</button>}
                               </div>
                             </td>
                           </tr>
                         ))}
                        {riders.length===0&&<tr><td colSpan={6} style={{textAlign:"center",color:"#000000",padding:"2rem"}}>No riders assigned yet.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tab==="team"&&(
                <div className={styles.sectionCard}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <h2>My Team</h2>
                      <p>University administrative team &nbsp;<span style={{background:'rgba(0,0,0,0.15)',color:'#FFFFFF',padding:'2px 8px',borderRadius:'12px',fontSize:'0.7rem',fontWeight:700}}>{team.length}/10 Members</span></p>
                    </div>
                    {/* Only HEAD university_admin or super admin can add staff */}
                    {(userCtx?.role === "university_admin" || userCtx?.role === "admin") && team.length < 10 && (
                      <button className={styles.btnPrimary} onClick={()=>setShowAddStaff(true)}><UserPlus size={15}/>Add Staff</button>
                    )}
                    {team.length >= 10 && <span style={{color:'#000000',fontSize:'0.75rem',fontWeight:600}}>Team Full (10/10)</span>}
                  </div>
                  <div className={styles.teamGrid}>
                    {team.map((m:any)=>(
                      <div key={m.id} className={styles.teamCard}>
                        <div className={styles.teamCardHeader}>
                          <div className={styles.teamAvatar}>{m.name?.charAt(0)?.toUpperCase() || "S"}</div>
                          <div>
                            <div style={{fontWeight:700}}>{m.name || m.email?.split('@')[0]}</div>
                            <div className={styles.subText}>{m.email}</div>
                          </div>
                        </div>
                        {/* Role badge */}
                        <span className={`${styles.badge} ${
                          m.role==="university_admin"?styles.badgeAdmin:
                          m.role==="university_staff"?styles.badgeStaff:
                          styles.badge
                        }`}>
                          {m.role==="university_admin"?"Head Admin":
                           m.role==="university_staff"?"Staff Member":
                           m.role}
                        </span>
                        {/* Permissions */}
                        {m.admin_permissions?.length>0&&(
                          <div className={styles.permsList}>{m.admin_permissions.map((p:string)=><span key={p} className={styles.permBadge}>{p}</span>)}</div>
                        )}
                        {/* Role-based dashboard hint */}
                        <div style={{marginTop:'0.5rem',fontSize:'0.65rem',color:'var(--text-400)',background:'var(--bg-300)',padding:'0.35rem 0.5rem',borderRadius:'6px'}}>
                          📊 Dashboard: {m.admin_permissions?.length>0 ? m.admin_permissions.join(', ') : 'Overview & Analytics'}
                        </div>
                        {/* Only HEAD admin or super admin can remove staff */}
                        {(userCtx?.role==="university_admin"||userCtx?.role==="admin")&&m.role!=="university_admin"&&m.id!==userCtx?.id&&(
                          <button className={`${styles.btnSm} ${styles.btnReject}`} style={{marginTop:"0.75rem"}} onClick={()=>{if(confirm("Remove staff member?"))action("remove_staff",{userId:m.id});}}><Trash2 size={13}/>Remove</button>
                        )}
                      </div>
                    ))}
                    {team.length===0&&<div style={{padding:"2rem",color:"#000000"}}>No staff added yet. Use Add Staff to build your team (max 10).</div>}
                  </div>
                </div>
              )}

              {tab==="catalog"&&(
                <div className={styles.sectionCard}>
                  <div className={styles.sectionHeader}><div><h2>University Catalog</h2><p>Monitor and control all products listed in your university</p></div></div>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead><tr><th>Product</th><th>Section</th><th>Brand</th><th>Visibility</th><th>Status</th><th>Stats</th><th>Actions</th></tr></thead>
                      <tbody>
                        {filter(products,["title"]).map((p:any)=>(
                          <tr key={p.id}>
                            <td>
                              <div className={styles.avatarCell}>
                                <img src={p.image_url||"/placeholder.png"} alt={p.title || ''} className={styles.prodThumb} />
                                <div><div style={{fontWeight:600}}>{p.title}</div><div className={styles.subText}>₦{p.price.toLocaleString()}</div></div>
                              </div>
                            </td>
                            <td>
                               <span className={`${styles.badge} ${p.product_section === 'delicacies' ? styles.badgeGold : styles.badgeInfo}`} style={{ fontSize: '0.6rem' }}>
                                 {p.product_section === 'delicacies' ? '🍔 DELICACIES' : '👕 FASHION'}
                               </span>
                            </td>
                            <td>{p.brands?.name}</td>
                            <td>
                               <span className={styles.badge} style={{ 
                                  background: p.visibility_type === 'global' ? 'rgba(0,0,0,0.15)' : '#121214', 
                                  color: p.visibility_type === 'global' ? '#FFFFFF' : 'var(--text-200)',
                                  fontSize: '0.65rem'
                               }}>
                                 {p.visibility_type === 'global' ? '🌍 Global' : '🎓 Campus'}
                               </span>
                            </td>
                            <td><span className={p.is_visible?styles.badgeActive:styles.badgeOffline}>{p.is_visible?"Visible":"Hidden"}</span></td>
                            <td className={styles.subText}>{p.sales_count} Sales / {p.views_count} Views</td>
                            <td>
                               <div className={styles.actionRow}>
                                 <button className={styles.btnSm} onClick={()=>action("update_product",{productId:p.id,isVisible:!p.is_visible})} title={p.is_visible?"Hide":"Show"}>{p.is_visible?<XCircle size={13}/>:<CheckCircle size={13}/>}</button>
                                 <button className={`${styles.btnSm} ${p.is_featured?styles.btnApprove:""}`} onClick={()=>action("update_product",{productId:p.id,isFeatured:!p.is_featured})} title={p.is_featured?"Unfeature":"Feature"}><Star size={13}/></button>
                                 <button className={`${styles.btnSm} ${styles.btnDelete}`} onClick={()=>{if(confirm("Delete product?")) action("delete_product",{productId:p.id});}} title="Delete Product"><Trash2 size={13}/></button>
                                 <button className={styles.btnSm} onClick={()=>{alert(`Properties: ${JSON.stringify(p.properties||{}, null, 2)}\n\nDescription: ${p.description||"No description"}`);}} title="View Details"><BarChart3 size={13}/></button>
                               </div>
                             </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tab === "merchandising" && (
                <div className={styles.sectionCard}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <h2>Homepage Merchandising</h2>
                      <p>Manage dynamic sections and automated rules for your students&apos; homepage.</p>
                    </div>
                    <button className={styles.btnPrimary} onClick={() => { setEditingSection(null); setSectionForm({ title: '', type: 'manual', layout_type: 'horizontal_scroll', is_active: true, priority: 0, auto_rule: { criteria: 'limited_stock', threshold: 5, limit: 12 } }); (document.getElementById('section-modal') as any)?.showModal(); }}>
                      <Plus size={15} /> New Section
                    </button>
                  </div>

                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Title</th>
                          <th>Type</th>
                          <th>Layout</th>
                          <th>Priority</th>
                          <th>Status</th>
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
                              <span className={`${styles.badge} ${sec.type === 'manual' ? styles.badgeGold : styles.badgeVerified}`}>
                                {sec.type.toUpperCase()}
                              </span>
                              {sec.type === 'automated' && <div className={styles.subText} style={{ fontSize: '0.65rem', marginTop: '4px' }}>Rule: {sec.auto_rule?.criteria}</div>}
                            </td>
                            <td><span className={styles.badgeGhost}>{sec.layout_type}</span></td>
                            <td>{sec.priority}</td>
                            <td><span className={sec.is_active ? styles.textGreen : styles.textRed}>{sec.is_active ? 'Active' : 'Inactive'}</span></td>
                            <td>
                              <div className={styles.actionRow}>
                                <button className={styles.btnSm} onClick={() => { setEditingSection(sec); setSectionForm(sec); (document.getElementById('section-modal') as any)?.showModal(); }}>
                                  <Settings size={14} />
                                </button>
                                {sec.type === 'manual' && (
                                  <button className={styles.btnSm} title="Manage Products" onClick={() => { setEditingSection(sec); (document.getElementById('product-picker-modal') as any)?.showModal(); }}>
                                    <ShoppingBag size={14} />
                                  </button>
                                )}
                                <button className={`${styles.btnSm} ${styles.btnDelete}`} onClick={() => confirm('Delete this section?') && action('delete_homepage_section', { id: sec.id })}>
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {homepageSections.length === 0 && (
                          <tr><td colSpan={6} style={{ textAlign: 'center' }} className={styles.subText}>No campus-specific sections configured.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Section Form Modal */}
                  <dialog id="section-modal" className={styles.modalDialog} style={{ padding: 0 }}>
                    <div className={styles.modalContent} style={{ maxWidth: '500px', background: 'var(--bg-100)', color: '#FFFFFF', borderRadius: '12px', border: '1px solid var(--border)' }}>
                      <div className={styles.modalHeader} style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0 }}>{editingSection ? 'Edit Section' : 'Create New Section'}</h3>
                        <button className={styles.btnIcon} onClick={() => (document.getElementById('section-modal') as any)?.close()}><XCircle size={20} /></button>
                      </div>
                      <div style={{ padding: '1.5rem' }}>
                        <div className="form-group mb-4">
                          <label className={styles.formLabel}>Title</label>
                          <input className={styles.formInput} value={sectionForm.title} onChange={e => setSectionForm({...sectionForm, title: e.target.value})} placeholder="e.g. Limited Stock Deals" />
                        </div>
                        <div className="form-group mb-4">
                          <label className={styles.formLabel}>Description (Optional)</label>
                          <input className={styles.formInput} value={sectionForm.description || ''} onChange={e => setSectionForm({...sectionForm, description: e.target.value})} placeholder="Short subtitle" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                          <div>
                            <label className={styles.formLabel}>Type</label>
                            <select className={styles.formInput} value={sectionForm.type} onChange={e => setSectionForm({...sectionForm, type: e.target.value})}>
                              <option value="manual">Manual Selection</option>
                              <option value="automated">System Automated</option>
                            </select>
                          </div>
                          <div>
                            <label className={styles.formLabel}>Layout</label>
                            <select className={styles.formInput} value={sectionForm.layout_type} onChange={e => setSectionForm({...sectionForm, layout_type: e.target.value})}>
                              <option value="horizontal_scroll">Horizontal Scroll</option>
                              <option value="grid">Grid (Recommended for large lists)</option>
                              <option value="banner">Promotional Banner</option>
                            </select>
                          </div>
                        </div>

                        {sectionForm.type === 'automated' && (
                          <div style={{ background: 'var(--bg-200)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                            <h4 style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>Automation Rules</h4>
                            <div className="form-group mb-3">
                              <label className={styles.subText}>Criteria</label>
                              <select className={styles.formInput} value={sectionForm.auto_rule?.criteria} onChange={e => setSectionForm({...sectionForm, auto_rule: {...sectionForm.auto_rule, criteria: e.target.value}})}>
                                <option value="limited_stock">Limited Stock (Selling fast)</option>
                                <option value="trending">Trending (High Views)</option>
                                <option value="top_sellers">Top Sellers (High Sales)</option>
                                <option value="hot_deals">Hot Deals (Best Discounts)</option>
                              </select>
                            </div>
                            <div className="form-group">
                              <label className={styles.subText}>Display Limit</label>
                              <input type="number" className={styles.formInput} value={sectionForm.auto_rule?.limit} onChange={e => setSectionForm({...sectionForm, auto_rule: {...sectionForm.auto_rule, limit: Number(e.target.value)}})} />
                            </div>
                          </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                          <div>
                            <label className={styles.formLabel}>Priority Order</label>
                            <input type="number" className={styles.formInput} value={sectionForm.priority} onChange={e => setSectionForm({...sectionForm, priority: Number(e.target.value)})} />
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                          <input type="checkbox" checked={sectionForm.is_active} onChange={e => setSectionForm({...sectionForm, is_active: e.target.checked})} id="sec-active-uni" />
                          <label htmlFor="sec-active-uni" style={{ cursor: 'pointer', fontSize: '0.85rem' }}>Visible on Student Homepage</label>
                        </div>

                        <button className={styles.btnPrimary} style={{ width: '100%' }} onClick={() => {
                          if (editingSection) action('update_homepage_section', { id: editingSection.id, updates: sectionForm });
                          else action('create_homepage_section', sectionForm);
                          (document.getElementById('section-modal') as any)?.close();
                        }}>
                          {editingSection ? 'Save Changes' : 'Create Section'}
                        </button>
                      </div>
                    </div>
                  </dialog>

                  {/* Product Picker Modal */}
                  <dialog id="product-picker-modal" className={styles.modalDialog} style={{ padding: 0 }}>
                     <div className={styles.modalContent} style={{ maxWidth: '800px', height: '80vh', background: 'var(--bg-100)', color: '#FFFFFF', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <div className={styles.modalHeader} style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h3 style={{ margin: 0 }}>Manage Products: {editingSection?.title}</h3>
                          <button className={styles.btnIcon} onClick={() => (document.getElementById('product-picker-modal') as any)?.close()}><XCircle size={20} /></button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', height: 'calc(100% - 70px)', padding: '1.5rem' }}>
                           <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden' }}>
                              <h4>University Catalog</h4>
                              <div className={styles.searchBar} style={{ width: '100%', background: 'var(--bg-200)' }}>
                                <Search size={14} />
                                <input placeholder="Filter products..." value={search} onChange={e => setSearch(e.target.value)} style={{ background: 'none', border: 'none', color: '#FFFFFF' }} />
                              </div>
                              <div style={{ overflowY: 'auto', flex: 1 }}>
                                 {filter(products, ['title']).slice(0, 50).map(p => (
                                   <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', padding: '0.75rem', background: 'var(--bg-200)', borderRadius: '8px' }}>
                                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                         <img src={p.image_url || p.media_urls?.[0]} alt={p.title || ''} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                                         <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.title}</div>
                                            <div className={styles.subText} style={{ fontSize: '0.7rem' }}>{p.brands?.name}</div>
                                         </div>
                                      </div>
                                      <button className={styles.btnSm} onClick={() => action('assign_product_to_section', { sectionId: editingSection.id, productId: p.id, position: 0 })}>Add</button>
                                   </div>
                                 ))}
                              </div>
                           </div>

                           <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden' }}>
                              <h4>Assigned to this Section</h4>
                              <div style={{ overflowY: 'auto', flex: 1 }}>
                                 <p className={styles.subText} style={{ fontSize: '0.8rem' }}>Added products will appear here after sync.</p>
                              </div>
                           </div>
                        </div>
                     </div>
                  </dialog>
                </div>
              )}

              {tab === "settings" && (
                <div className={styles.sectionCard}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <h2>Campus Settings</h2>
                      <p>Configure university-specific options and support channels.</p>
                    </div>
                  </div>
                  
                  <div className={styles.notifForm} style={{ maxWidth: '600px' }}>
                    <div className="mb-6">
                      <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>Customer Service</h3>
                      <p className={styles.subText} style={{ marginBottom: '1.5rem' }}>
                        Set your university&apos;s dedicated WhatsApp support number. Students will see this when they need help.
                      </p>
                      
                      <div className="form-group mb-4">
                        <label className={styles.formLabel}>WhatsApp Support Number</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input 
                            className={styles.formInput} 
                            placeholder="e.g. 2347012345678" 
                            value={platformSettings.customer_service_whatsapp || ''} 
                            onChange={e => setPlatformSettings({...platformSettings, customer_service_whatsapp: e.target.value})} 
                          />
                          <button 
                            className={styles.btnPrimary}
                            onClick={() => action("update_uni_config", { university_id: myUniversity?.id, key: 'customer_service_whatsapp', value: platformSettings.customer_service_whatsapp })}
                            disabled={!!actionLoading}
                          >
                            {actionLoading ? <Loader2 size={14} className={styles.spin} /> : 'Save'}
                          </button>
                        </div>
                        <p className={styles.subText} style={{ fontSize: '0.7rem', marginTop: '0.5rem' }}>
                          Format: Country code first (e.g., 234 for Nigeria) followed by the number. No spaces or &apos;+&apos; sign.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className={styles.sectionCard} style={{ marginTop: '2rem' }}>
                    <div className={styles.sectionHeader}><div><h2>Platform Standings</h2><p>View where your university ranks globally</p></div></div>
                    <div style={{ padding: '1.5rem' }}>
                      <Link 
                        href="/rankings" 
                        className={styles.btnPrimary} 
                        style={{ background: 'linear-gradient(135deg, #000000 0%, #000000 100%)', width: 'fit-content' }}
                      >
                        🏆 Open University Leaderboard
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {tab === "cafeterias" && (
                <div className={styles.sectionCard}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <h2>Cafeterias & Food Courts</h2>
                      <p>Add and manage active dining areas for delicacies vendors on your campus.</p>
                    </div>
                    <button className={styles.btnPrimary} onClick={() => {
                      setCafeteriaForm({ id: "", name: "", description: "", is_active: true });
                      setShowCafeteriaModal(true);
                    }}>
                      <Plus size={15} /> New Cafeteria
                    </button>
                  </div>

                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Cafeteria Name</th>
                          <th>Description</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filter(cafeterias, ["name", "description"]).map(c => (
                          <tr key={c.id}>
                            <td>
                              <div style={{ fontWeight: 700 }}>{c.name}</div>
                            </td>
                            <td>
                              <div className={styles.subText}>{c.description || "No description"}</div>
                            </td>
                            <td>
                              <span className={`${styles.badge} ${c.is_active ? styles.badgeActive : styles.badgeOffline}`}>
                                {c.is_active ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td>
                              <div className={styles.actionRow}>
                                <button className={styles.btnSm} title="Toggle Status" onClick={() => action("toggle_cafeteria", { id: c.id, is_active: !c.is_active })}>
                                  {c.is_active ? <XCircle size={13}/> : <CheckCircle size={13}/>}
                                </button>
                                <button className={styles.btnSm} title="Edit" onClick={() => {
                                  setCafeteriaForm({ id: c.id, name: c.name, description: c.description || "", is_active: c.is_active });
                                  setShowCafeteriaModal(true);
                                }}>
                                  <Settings size={13} />
                                </button>
                                <button className={`${styles.btnSm} ${styles.btnDelete}`} title="Delete" onClick={() => {
                                  if (confirm("Delete this cafeteria? Edible vendors will no longer be able to select it.")) {
                                    action("delete_cafeteria", { id: c.id });
                                  }
                                }}>
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {cafeterias.length === 0 && (
                          <tr>
                            <td colSpan={4} style={{ textAlign: "center", color: "#000000", padding: "2rem" }}>
                              No cafeterias configured for this campus yet. Click &quot;New Cafeteria&quot; to add one.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tab === "manual_transfers" && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
                  
                  {/* 1. TOP METRICS HEADER */}
                  <div className={styles.statsGrid}>
                    {/* Daily Manual Transactions Sum */}
                    <div className={styles.statCard}>
                      <div>
                        <div className={styles.statLabel}>📅 Daily Manual Sales (Today)</div>
                        <div className={styles.statValue} style={{ color: '#FFFFFF' }}>
                          ₦{manualOrders.filter(o => o.manual_payment_status === 'approved' && new Date(o.created_at).toDateString() === new Date().toDateString()).reduce((sum, o) => sum + Number(o.total_amount), 0).toLocaleString()}
                        </div>
                        <div className={styles.subText}>
                          {manualOrders.filter(o => o.manual_payment_status === 'approved' && new Date(o.created_at).toDateString() === new Date().toDateString()).length} verified orders today
                        </div>
                      </div>
                    </div>

                    {/* Pending Manual Queue Count */}
                    <div className={styles.statCard}>
                      <div>
                        <div className={styles.statLabel}>⏳ Pending Verification Queue</div>
                        <div className={styles.statValue} style={{ color: '#FFFFFF' }}>
                          {manualOrders.filter(o => o.status === 'pending' && o.manual_payment_status === 'pending').length}
                        </div>
                        <div className={styles.subText}>Needs manual approval</div>
                      </div>
                    </div>

                    {/* All-time Manual Sales */}
                    <div className={styles.statCard}>
                      <div>
                        <div className={styles.statLabel}>🏛️ Total Manual Sales (All-time)</div>
                        <div className={styles.statValue} style={{ color: 'var(--primary)' }}>
                          ₦{manualOrders.filter(o => o.manual_payment_status === 'approved').reduce((sum, o) => sum + Number(o.total_amount), 0).toLocaleString()}
                        </div>
                        <div className={styles.subText}>
                          {manualOrders.filter(o => o.manual_payment_status === 'approved').length} total orders verified
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. CAMPUS BANK ACCOUNTS CONFIGURATION CARD */}
                  <div className={styles.sectionCard} style={{ background: 'linear-gradient(135deg, var(--bg-200), rgba(0,0,0,0.03))' }}>
                    <div className={styles.sectionHeader}>
                      <div>
                        <h2>🏦 Campus Bank Accounts</h2>
                        <p>Configure bank accounts for manual checkout. Only the <strong style={{ color: 'var(--primary)' }}>Active</strong> account will be shown to students at checkout.</p>
                      </div>
                      <button 
                        className={styles.btnPrimary}
                        onClick={() => {
                          setBankForm({ id: '', bank_name: '', bank_code: '', account_number: '', account_name: '', label: 'Main Account' });
                          setShowBankModal(true);
                        }}
                      >
                        <Plus size={15} /> Add Bank Account
                      </button>
                    </div>

                    <div className={styles.tableWrap}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Label / Account Name</th>
                            <th>Bank Info</th>
                            <th>Account Number</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bankAccounts.map((account: any) => (
                            <tr key={account.id}>
                              <td>
                                <div style={{ fontWeight: 700 }}>{account.label || 'Main Account'}</div>
                                <div className={styles.subText}>{account.account_name}</div>
                              </td>
                              <td>{account.bank_name}</td>
                              <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary)', letterSpacing: '0.05em' }}>{account.account_number}</td>
                              <td>
                                 {account.is_active ? (
                                   <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-start' }}>
                                     <span style={{ background: '#121214', color: '#FFFFFF', border: '1px solid #A0A0A0', borderRadius: '6px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                       <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#121214', display: 'inline-block' }}></span>
                                       Active at Checkout
                                     </span>
                                     <button
                                       className={styles.btnSm}
                                       style={{ fontSize: '0.7rem', background: '#121214', color: '#FFFFFF', border: '1px solid rgba(0,0,0,0.2)' }}
                                       onClick={() => action('toggle_bank_active', { id: account.id, is_active: false })}
                                       disabled={!!actionLoading}
                                     >
                                       Deactivate
                                     </button>
                                   </div>
                                 ) : (
                                   <button
                                     className={styles.btnSm}
                                     style={{ background: 'rgba(0,0,0,0.1)', color: 'var(--primary)', border: '1px solid rgba(0,0,0,0.3)', fontWeight: 600 }}
                                     onClick={() => action('toggle_bank_active', { id: account.id, is_active: true })}
                                     disabled={!!actionLoading}
                                     title="Set this as the active checkout account (deactivates others)"
                                   >
                                     Set Active
                                   </button>
                                 )}
                               </td>
                              <td>
                                <div className={styles.actionRow}>
                                  <button 
                                    className={styles.btnSm}
                                    onClick={() => {
                                      setBankForm({
                                        id: account.id,
                                        bank_name: account.bank_name,
                                        bank_code: account.bank_code || '',
                                        account_number: account.account_number,
                                        account_name: account.account_name,
                                        label: account.label || 'Main Account',
                                      });
                                      setShowBankModal(true);
                                    }}
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button 
                                    className={`${styles.btnSm} ${styles.btnReject}`}
                                    onClick={() => {
                                      if (confirm('Are you sure you want to delete this bank account?')) {
                                        action('delete_bank_account', { id: account.id });
                                      }
                                    }}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {bankAccounts.length === 0 && (
                            <tr>
                              <td colSpan={5} style={{ textAlign: 'center', color: '#000000', padding: '2rem' }}>
                                No bank accounts configured yet. Students at checkout will see the platform default manual payment account.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 3. SEGMENTED CONTROLS FOR QUEUE */}
                  <div style={{ display: 'flex', gap: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                    <button 
                      onClick={() => setManualQueueSubTab('pending')}
                      className={`${styles.btnSm} ${manualQueueSubTab === 'pending' ? styles.btnApprove : styles.btnReject}`}
                      style={{ background: manualQueueSubTab === 'pending' ? 'var(--primary)' : '#121214', color: '#FFFFFF', border: '1px solid var(--border)' }}
                    >
                      Pending Queue ({manualOrders.filter(o => o.status === 'pending' && o.manual_payment_status === 'pending').length})
                    </button>
                    <button 
                      onClick={() => setManualQueueSubTab('history')}
                      className={`${styles.btnSm} ${manualQueueSubTab === 'history' ? styles.btnApprove : styles.btnReject}`}
                      style={{ background: manualQueueSubTab === 'history' ? 'var(--primary)' : '#121214', color: '#FFFFFF', border: '1px solid var(--border)' }}
                    >
                      Verification History
                    </button>
                  </div>

                  {/* Sub Tab: Pending Queue */}
                  {manualQueueSubTab === 'pending' && (
                    <div className={styles.sectionCard}>
                      <div className={styles.sectionHeader}>
                        <h2>Pending Manual Bank Transfers</h2>
                        <p>Review and verify transfer receipts to authorize student orders.</p>
                      </div>

                      {manualOrders.filter(o => o.status === 'pending' && o.manual_payment_status === 'pending').length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-400)' }}>
                          <ShieldCheck size={48} style={{ color: '#FFFFFF', marginBottom: '1rem', opacity: 0.6 }} />
                          <h4 style={{ margin: 0, color: '#FFFFFF', fontWeight: 600 }}>All Clear!</h4>
                          <p className={styles.subText} style={{ marginTop: '0.25rem' }}>No pending manual transfers waiting to be verified.</p>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                          {manualOrders.filter(o => o.status === 'pending' && o.manual_payment_status === 'pending').map((o) => (
                            <div 
                              key={o.id} 
                              style={{ 
                                background: 'var(--bg-200)', 
                                border: '1px solid var(--border)', 
                                borderRadius: '12px', 
                                padding: '1.5rem', 
                                display: 'grid', 
                                gridTemplateColumns: '1fr auto',
                                gap: '1.5rem',
                                alignItems: 'center'
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)', background: 'rgba(0,0,0,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>
                                    ORDER #{o.id.slice(0, 8).toUpperCase()}
                                  </span>
                                  <span className={styles.subText} style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Clock size={12} /> {new Date(o.created_at).toLocaleString()}
                                  </span>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '0.25rem' }}>
                                  <div>
                                    <span className={styles.subText} style={{ fontSize: '0.7rem', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Customer</span>
                                    <strong style={{ fontSize: '0.9rem', color: '#FFFFFF' }}>{o.users?.name || 'Customer'}</strong>
                                    <span className={styles.subText} style={{ display: 'block', fontSize: '0.8rem' }}>{o.users?.email}</span>
                                  </div>
                                  <div>
                                    <span className={styles.subText} style={{ fontSize: '0.7rem', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Vendor / Store</span>
                                    <strong style={{ fontSize: '0.9rem', color: '#FFFFFF' }}>{o.brands?.name || 'Vendor'}</strong>
                                  </div>
                                  <div>
                                    <span className={styles.subText} style={{ fontSize: '0.7rem', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Submitted Bank Details</span>
                                    <div style={{ background: 'var(--bg-300)', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                                      <div>🏛️ <strong style={{ color: '#FFFFFF' }}>{o.manual_payment_details?.sender_bank || '—'}</strong></div>
                                      <div style={{ margin: '2px 0' }}>👤 {o.manual_payment_details?.account_name || '—'}</div>
                                      <div style={{ fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 600 }}>🔑 Ref: {o.manual_payment_details?.receipt_code || '—'}</div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1rem' }}>
                                <div style={{ textAlign: 'right' }}>
                                  <span className={styles.subText} style={{ fontSize: '0.75rem' }}>Total Amount</span>
                                  <h3 style={{ color: '#FFFFFF', margin: 0, fontWeight: 800, fontSize: '1.5rem' }}>₦{Number(o.total_amount || 0).toLocaleString()}</h3>
                                </div>

                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                  <button 
                                    className={styles.btnSm} 
                                    style={{ background: 'none', color: '#000000', border: '1px solid #27272A', height: '38px', padding: '0 1rem', borderRadius: '6px' }}
                                    disabled={!!actionLoading}
                                    onClick={async () => {
                                      const reason = prompt('Please enter the reason for rejecting this manual payment receipt:');
                                      if (reason === null) return;
                                      await action('reject_manual_payment', { orderId: o.id, reason });
                                    }}
                                  >
                                    Reject Receipt
                                  </button>
                                  <button 
                                    className={styles.btnPrimary} 
                                    style={{ background: '#121214', borderColor: '#27272A', height: '38px', color: '#000000', fontWeight: 700 }}
                                    disabled={!!actionLoading}
                                    onClick={async () => {
                                      if (confirm(`Verify GTB transfer of ₦${Number(o.total_amount || 0).toLocaleString()}? This authorizes the vendor store to fulfill the order.`)) {
                                        await action('verify_manual_payment', { orderId: o.id });
                                      }
                                    }}
                                  >
                                    Approve Payment
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Sub Tab: History Log */}
                  {manualQueueSubTab === 'history' && (
                    <div className={styles.sectionCard}>
                      <div className={styles.sectionHeader}>
                        <h2>Verification History Log</h2>
                        <p>Historical archive of approved or rejected manual transfer checkouts.</p>
                      </div>

                      {manualOrders.filter(o => o.manual_payment_status !== 'pending').length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-400)' }}>
                          <Clock size={48} style={{ color: 'var(--primary)', marginBottom: '1rem', opacity: 0.6 }} />
                          <h4 style={{ margin: 0, color: '#FFFFFF', fontWeight: 600 }}>Log is Empty</h4>
                          <p className={styles.subText} style={{ marginTop: '0.25rem' }}>No historical manual verifications recorded yet.</p>
                        </div>
                      ) : (
                        <div className={styles.tableWrap}>
                          <table className={styles.table}>
                            <thead>
                              <tr>
                                <th>Order Info</th>
                                <th>Customer</th>
                                <th>Submitted Bank Details</th>
                                <th>Amount</th>
                                <th>Verification Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {manualOrders.filter(o => o.manual_payment_status !== 'pending').map((o) => (
                                <tr key={o.id}>
                                  <td>
                                    <div style={{ fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace' }}>
                                      #{o.id.slice(0, 8).toUpperCase()}
                                    </div>
                                    <div className={styles.subText} style={{ fontSize: '0.7rem' }}>
                                      {new Date(o.created_at).toLocaleString()}
                                    </div>
                                  </td>
                                  <td>
                                    <div style={{ fontWeight: 600 }}>{o.users?.name || 'Customer'}</div>
                                    <div className={styles.subText}>{o.users?.email}</div>
                                  </td>
                                  <td>
                                    <div style={{ fontSize: '0.8rem' }}>
                                      <strong>{o.manual_payment_details?.sender_bank || '—'}</strong> ({o.manual_payment_details?.account_name || '—'})
                                    </div>
                                    <div className={styles.subText} style={{ fontFamily: 'monospace' }}>Ref: {o.manual_payment_details?.receipt_code || '—'}</div>
                                  </td>
                                  <td>
                                    <strong style={{ color: '#FFFFFF' }}>₦{Number(o.total_amount || 0).toLocaleString()}</strong>
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <span className={styles.badge} style={{ width: 'fit-content', background: o.manual_payment_status === 'approved' ? '#121214' : 'rgba(0,0,0,0.1)', color: o.manual_payment_status === 'approved' ? '#FFFFFF' : '#000000' }}>
                                        {o.manual_payment_status === 'approved' ? '✓ Verified' : '✗ Rejected'}
                                      </span>
                                      {o.manual_payment_status === 'rejected' && o.manual_payment_details?.rejection_reason && (
                                        <span className={styles.subText} style={{ color: '#000000', fontSize: '0.75rem', maxWidth: '200px' }}>
                                          Reason: {o.manual_payment_details.rejection_reason}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {tab === "categories" && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
                  
                  {/* Segmented Controls for Edible / Non-Edible */}
                  <div style={{ display: 'flex', gap: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                    <button 
                      onClick={() => setCategorySubTab('edible')}
                      className={`${styles.btnSm} ${categorySubTab === 'edible' ? styles.btnApprove : styles.btnReject}`}
                      style={{ background: categorySubTab === 'edible' ? 'var(--primary)' : '#121214', color: '#FFFFFF', border: '1px solid var(--border)' }}
                    >
                      🍱 Edible Categories
                    </button>
                    <button 
                      onClick={() => setCategorySubTab('non_edible')}
                      className={`${styles.btnSm} ${categorySubTab === 'non_edible' ? styles.btnApprove : styles.btnReject}`}
                      style={{ background: categorySubTab === 'non_edible' ? 'var(--primary)' : '#121214', color: '#FFFFFF', border: '1px solid var(--border)' }}
                    >
                      👕 Non-Edible Categories
                    </button>
                  </div>

                  <div className={styles.sectionCard}>
                    <div className={styles.sectionHeader}>
                      <div>
                        <h2>🎒 Category Catalog ({categorySubTab === 'edible' ? 'Edible' : 'Non-Edible'})</h2>
                        <p>Manage product categorization tags available for campus vendors.</p>
                      </div>
                      <button 
                        className={styles.btnPrimary}
                        onClick={() => {
                          setCategoryForm({ id: '', name: '', type: categorySubTab, icon: '📦', is_active: true, sort_order: categories.length + 1 });
                          setShowCategoryModal(true);
                        }}
                      >
                        <Plus size={15} /> Add Category
                      </button>
                    </div>

                    <div className={styles.tableWrap}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Icon</th>
                            <th>Category Name</th>
                            <th>Slug</th>
                            <th>Type Scope</th>
                            <th>Sort Order</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categories.filter(c => c.type === categorySubTab).map((cat: any) => (
                            <tr key={cat.id}>
                              <td style={{ fontSize: '1.5rem', width: '60px', textAlign: 'center' }}>{cat.icon || '📦'}</td>
                              <td><strong style={{ color: '#FFFFFF' }}>{cat.name}</strong></td>
                              <td style={{ fontFamily: 'monospace', color: 'var(--primary)' }}>{cat.slug}</td>
                              <td>
                                {cat.university_id ? (
                                  <span className={styles.badgeActive} style={{ fontSize: '0.65rem' }}>🎓 Campus Specific</span>
                                ) : (
                                  <span className={styles.badge} style={{ fontSize: '0.65rem', background: 'rgba(0,0,0,0.15)', color: '#FFFFFF' }}>🌍 Global Standings</span>
                                )}
                              </td>
                              <td>{cat.sort_order || 0}</td>
                              <td>
                                <span className={cat.is_active ? styles.badgeActive : styles.badgeOffline}>
                                  {cat.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td>
                                <div className={styles.actionRow}>
                                  {/* Only campus-specific categories can be deleted or updated by campus admin */}
                                  {cat.university_id ? (
                                    <>
                                      <button 
                                        className={styles.btnSm}
                                        onClick={() => {
                                          setCategoryForm({
                                            id: cat.id,
                                            name: cat.name,
                                            type: cat.type,
                                            icon: cat.icon || '📦',
                                            is_active: cat.is_active,
                                            sort_order: cat.sort_order || 0
                                          });
                                          setShowCategoryModal(true);
                                        }}
                                      >
                                        <Edit2 size={13} />
                                      </button>
                                      <button 
                                        className={`${styles.btnSm} ${styles.btnReject}`}
                                        onClick={() => {
                                          if (confirm('Delete this custom category? Products under this category will need updating.')) {
                                            action('delete_category', { id: cat.id });
                                          }
                                        }}
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </>
                                  ) : (
                                    <span className={styles.subText} style={{ fontSize: '0.7rem' }}>Global (Read-Only)</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                          {categories.filter(c => c.type === categorySubTab).length === 0 && (
                            <tr>
                              <td colSpan={7} style={{ textAlign: 'center', color: '#000000', padding: '2rem' }}>
                                No categories listed in this section yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      {showCafeteriaModal && (
        <div className={styles.modalOverlay} onClick={() => setShowCafeteriaModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3>{cafeteriaForm.id ? 'Edit Cafeteria' : 'Add Cafeteria'}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label className={styles.formLabel}>Cafeteria Name</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="e.g. Sub Dome / Abiola Food Court"
                  value={cafeteriaForm.name}
                  onChange={e => setCafeteriaForm({ ...cafeteriaForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className={styles.formLabel}>Description</label>
                <textarea
                  className={styles.formInput}
                  style={{ height: '80px', resize: 'none', padding: '0.5rem' }}
                  placeholder="e.g. Near the main lecture theater, serving hot meals."
                  value={cafeteriaForm.description}
                  onChange={e => setCafeteriaForm({ ...cafeteriaForm, description: e.target.value })}
                />
              </div>
              <div>
                <label className={styles.formLabel} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={cafeteriaForm.is_active}
                    onChange={e => setCafeteriaForm({ ...cafeteriaForm, is_active: e.target.checked })}
                  />
                  Active & Available for Vendors
                </label>
              </div>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  className={styles.btnPrimary}
                  disabled={!cafeteriaForm.name}
                  onClick={async () => {
                    await action("upsert_cafeteria", cafeteriaForm);
                    setShowCafeteriaModal(false);
                  }}
                >
                  {cafeteriaForm.id ? 'Save Changes' : 'Create Cafeteria'}
                </button>
                <button className={styles.btnSm} onClick={() => setShowCafeteriaModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showAddStaff&&(
        <div className={styles.modalOverlay} onClick={()=>setShowAddStaff(false)}>
          <div className={styles.modal} onClick={e=>e.stopPropagation()}>
            <h3>Add Staff Member</h3>
            <div style={{display:"flex",flexDirection:"column",gap:"1rem"}}>
              <div style={{position:"relative"}}>
                <label className={styles.formLabel}>Search University User</label>
                <div className={styles.searchBar} style={{background:"var(--bg-200)", padding:"0 0.75rem"}}>
                  <Search size={14}/>
                  <input 
                    className={styles.formInput} 
                    style={{border:"none", background:"none"}}
                    placeholder="Type name or email..." 
                    value={staffSearch} 
                    onChange={e=>setStaffSearch(e.target.value)}
                  />
                </div>
                {staffSearch.length > 1 && (
                  <div style={{position:"absolute", top:"100%", left:0, right:0, background:"#000000", border:"1px solid var(--primary)", borderRadius:"8px", marginTop:"4px", zIndex:200, maxHeight:"200px", overflowY:"auto"}}>
                    {customers.filter(u => u.name?.toLowerCase().includes(staffSearch.toLowerCase()) || u.email.toLowerCase().includes(staffSearch.toLowerCase())).map(u => (
                      <div 
                        key={u.id} 
                        style={{padding:"0.75rem", cursor:"pointer", borderBottom:"1px solid rgba(255,255,255,0.05)"}}
                        onClick={()=>{
                          setStaffForm({...staffForm, userId:u.id});
                          setStaffSearch(u.name || u.email);
                        }}
                      >
                        <div style={{fontWeight:600, fontSize:"0.85rem"}}>{u.name || u.email.split('@')[0]}</div>
                        <div style={{fontSize:"0.7rem", color:"var(--text-400)"}}>{u.email}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className={styles.formLabel}>Role</label>
                <select className={styles.formSelect} value={staffForm.staffRole} onChange={e=>setStaffForm({...staffForm,staffRole:e.target.value})}>
                  <option value="university_staff">University Staff</option>
                  <option value="university_admin">University Admin</option>
                </select>
              </div>
              <div>
                <label className={styles.formLabel}>Permissions</label>
                <div className={styles.permCheckGrid}>
                  {["vendors","customers","orders","reviews","fleet","notices","verify_payments"].map(p=>(
                    <label key={p} className={styles.permCheck}>
                      <input type="checkbox" checked={staffForm.permissions.includes(p)} onChange={e=>{
                        const next = e.target.checked ? [...staffForm.permissions,p] : staffForm.permissions.filter(x=>x!==p);
                        setStaffForm({...staffForm,permissions:next});
                      }}/>
                      {p === "verify_payments" ? "Payment Verifier" : p.charAt(0).toUpperCase()+p.slice(1)}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{display:"flex",gap:"0.75rem"}}>
                <button className={styles.btnPrimary} disabled={addStaffLoading||!staffForm.userId} onClick={async()=>{
                  setAddStaffLoading(true);
                  await action("add_staff",staffForm);
                  setShowAddStaff(false);
                  setAddStaffLoading(false);
                }}>{addStaffLoading?"Adding...":"Add Staff"}</button>
                <button className={styles.btnSm} onClick={()=>setShowAddStaff(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBankModal && (
        <div className={styles.modalOverlay} onClick={() => setShowBankModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3>{bankForm.id ? '🔧 Edit Bank Account' : '🏦 Add Bank Account'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className={styles.formLabel}>Select Bank</label>
                <select 
                  className={styles.formSelect} 
                  value={bankForm.bank_code} 
                  onChange={e => setBankForm({ ...bankForm, bank_code: e.target.value, bank_name: availableBanks.find(b => b.code === e.target.value)?.name || '' })}
                >
                  <option value="">-- Choose Bank --</option>
                  {availableBanks.map(b => (
                    <option key={b.code} value={b.code}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={styles.formLabel}>Account Number (10 digits)</label>
                <input 
                  type="text" 
                  className={styles.formInput} 
                  maxLength={10}
                  placeholder="e.g. 0123456789"
                  value={bankForm.account_number}
                  onChange={e => setBankForm({ ...bankForm, account_number: e.target.value.replace(/\D/g, '') })}
                />
              </div>
              <div>
                <label className={styles.formLabel}>
                  Account Name {resolvingBank && <span className={styles.subText} style={{ color: 'var(--primary)' }}>(resolving...)</span>}
                </label>
                <input 
                  type="text" 
                  className={styles.formInput} 
                  placeholder="Resolved account name..."
                  value={bankForm.account_name}
                  onChange={e => setBankForm({ ...bankForm, account_name: e.target.value })}
                />
              </div>
              <div>
                <label className={styles.formLabel}>Label / Purpose</label>
                <input 
                  type="text" 
                  className={styles.formInput} 
                  placeholder="e.g. Main Account, Secondary Account"
                  value={bankForm.label}
                  onChange={e => setBankForm({ ...bankForm, label: e.target.value })}
                />
              </div>
              <div style={{ background: 'rgba(0,0,0,0.07)', border: '1px solid rgba(0,0,0,0.2)', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--text-300)', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <span style={{ fontSize: '1rem', flexShrink: 0 }}>💡</span>
                <span>After saving, use the <strong style={{ color: 'var(--primary)' }}>Set Active</strong> button in the table to make this account visible to students at checkout. Only one account can be active at a time.</span>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button 
                  className={styles.btnPrimary} 
                  disabled={!bankForm.bank_code || bankForm.account_number.length !== 10 || !bankForm.account_name || resolvingBank}
                  onClick={async () => {
                    await action('upsert_bank_account', bankForm);
                    setShowBankModal(false);
                  }}
                >
                  {bankForm.id ? 'Save Changes' : 'Add Bank Account'}
                </button>
                <button className={styles.btnSm} onClick={() => setShowBankModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCategoryModal && (
        <div className={styles.modalOverlay} onClick={() => setShowCategoryModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3>{categoryForm.id ? '🔧 Edit Custom Category' : '🎒 Add Custom Category'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className={styles.formLabel}>Category Name</label>
                <input 
                  type="text" 
                  className={styles.formInput} 
                  placeholder="e.g. Traditional Wears / Native Delicacies"
                  value={categoryForm.name}
                  onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className={styles.formLabel}>Type</label>
                <select 
                  className={styles.formSelect} 
                  value={categoryForm.type}
                  onChange={e => setCategoryForm({ ...categoryForm, type: e.target.value })}
                >
                  <option value="edible">🍱 Edible (Delicacies)</option>
                  <option value="non_edible">👕 Non-Edible (Fashion/Others)</option>
                </select>
              </div>
              <div>
                <label className={styles.formLabel}>Emoji Icon</label>
                <input 
                  type="text" 
                  className={styles.formInput} 
                  placeholder="e.g. 🍔 / 👕 / 📦"
                  maxLength={4}
                  value={categoryForm.icon}
                  onChange={e => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                />
              </div>
              <div>
                <label className={styles.formLabel}>Sort Order</label>
                <input 
                  type="number" 
                  className={styles.formInput} 
                  value={categoryForm.sort_order}
                  onChange={e => setCategoryForm({ ...categoryForm, sort_order: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className={styles.formLabel} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={categoryForm.is_active}
                    onChange={e => setCategoryForm({ ...categoryForm, is_active: e.target.checked })}
                  />
                  Active & Available for Vendors
                </label>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button 
                  className={styles.btnPrimary} 
                  disabled={!categoryForm.name}
                  onClick={async () => {
                    await action('upsert_category', categoryForm);
                    setShowCategoryModal(false);
                  }}
                >
                  {categoryForm.id ? 'Save Changes' : 'Create Category'}
                </button>
                <button className={styles.btnSm} onClick={() => setShowCategoryModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

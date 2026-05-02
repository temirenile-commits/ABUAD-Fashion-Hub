"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import styles from "./university-admin.module.css";
import {
  LayoutDashboard, Store, Users, ShoppingCart, Star, Bell,
  BarChart3, Globe, Truck, Shield, LogOut, RefreshCw, Search,
  CheckCircle, XCircle, Loader2, AlertTriangle, Plus, UserPlus, Trash2, Tag, Settings, ShoppingBag, ShoppingCart as OrderIcon
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';

type Tab = "overview"|"vendors"|"customers"|"orders"|"reviews"|"notices"|"analytics"|"insights"|"fleet"|"team"|"catalog"|"merchandising";

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
  const [orders, setOrders] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [riders, setRiders] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [staffSearch, setStaffSearch] = useState("");

  const [notifForm, setNotifForm] = useState({ title:"", content:"", target:"all" });
  const [notifSending, setNotifSending] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [staffForm, setStaffForm] = useState({ userId:"", staffRole:"university_staff", permissions:[] as string[] });
  const [addStaffLoading, setAddStaffLoading] = useState(false);
  const [orderFilter, setOrderFilter] = useState("all");
  const [homepageSections, setHomepageSections] = useState<any[]>([]);
  const [sectionForm, setSectionForm] = useState<any>({ title: '', type: 'manual', layout_type: 'horizontal_scroll', is_active: true, priority: 0, auto_rule: { criteria: 'limited_stock', threshold: 5, limit: 12 } });
  const [editingSection, setEditingSection] = useState<any>(null);

  const [billboardUpload, setBillboardUpload] = useState({ title: '', sub: '', link: '', file: null as File|null });
  const [uploadingBillboard, setUploadingBillboard] = useState(false);

  const handleBillboardUpload = async () => {
    if (!billboardUpload.file || !billboardUpload.title) return alert('Image and Title required');
    setUploadingBillboard(true);
    try {
      const ext = billboardUpload.file.name.split('.').pop();
      const path = `manual_billboards/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('products').upload(path, billboardUpload.file);
      if (uploadError) throw uploadError;
      
      const { data } = supabase.storage.from('products').getPublicUrl(path);
      
      const res = await uaFetch("/api/university-admin", { 
        method: "POST", 
        body: JSON.stringify({ 
          action: "add_manual_billboard", 
          title: billboardUpload.title,
          description: billboardUpload.sub,
          link: billboardUpload.link,
          cover_url: data.publicUrl
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
      const { data: profile } = await supabase.from("users").select("*, universities(*)").eq("id", session.user.id).single();
      if (profile) {
        // Redirect support agents to their dedicated dashboard
        if (profile.role === 'customer_support_agent') {
          router.replace('/dashboard/support');
          return;
        }
        setUserCtx(profile);
        setMyUniversity(profile.universities);
      }
    };
    init();
  }, [router]);

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const actions = ["stats","vendors","customers","orders","reviews","riders","analytics","cross_university_insights","team","products", "merchandising"];
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
      setInsights(g(7).insights||[]);
      setTeam(g(8).team||[]);
      setProducts(g(9).products||[]);
      setHomepageSections(g(10).sections||[]);
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
    return items.filter(i => fields.some(f => String(i[f]||"").toLowerCase().includes(search.toLowerCase())));
  };

  const pendingVendors = vendors.filter(v => v.verification_status==="pending");

  const TABS: [Tab, string, any][] = [
    ["overview","Overview",LayoutDashboard],["vendors","Vendors",Store],["catalog","Catalog",ShoppingCart],["customers","Customers",Users],
    ["orders","Orders",ShoppingCart],["reviews","Reviews",Star],["notices","Notices",Bell],["merchandising", "Merchandising", Tag],
    ["analytics","Analytics",BarChart3],["insights","Insights",Globe],["fleet","Fleet",Truck],["team","My Team",Shield],
  ];

  const hasAccess = (tabId: string) => {
    if (userCtx?.role === "admin" || userCtx?.role === "university_admin") return true;
    if (["overview", "analytics", "insights"].includes(tabId)) return true;
    return userCtx?.admin_permissions?.includes(tabId);
  };

  const visibleManagement = TABS.slice(0,5).filter(t => hasAccess(t[0]));
  const visibleCommunication = TABS.slice(5,6).filter(t => hasAccess(t[0]));
  const visibleOps = TABS.slice(6).filter(t => hasAccess(t[0]));

  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logoMark}>
            <div className={styles.logoIcon}>🏛</div>
            <span className={styles.logoText}>UNI ADMIN</span>
          </div>
          {myUniversity && <div className={styles.universityBadge}>📍 {myUniversity.abbreviation||myUniversity.name}</div>}
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
                  <div className={styles.statsGrid}>
                    {[
                      {label:"Vendors",val:stats.totalVendors||0,color:"#7c3aed",bg:"rgba(124,58,237,0.1)"},
                      {label:"Customers",val:stats.totalUsers||0,color:"#3b82f6",bg:"rgba(59,130,246,0.1)"},
                      {label:"Total Orders",val:stats.totalOrders||0,color:"#f59e0b",bg:"rgba(245,158,11,0.1)"},
                      {label:"Paid Orders",val:stats.paidOrders||0,color:"#10b981",bg:"rgba(16,185,129,0.1)"},
                      {label:"Revenue",val:`₦${(stats.totalRevenue||0).toLocaleString()}`,color:"#ec4899",bg:"rgba(236,72,153,0.1)"},
                      {label:"Riders",val:stats.totalRiders||0,color:"#06b6d4",bg:"rgba(6,182,212,0.1)"},
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
                          <tbody>{stats.popularProducts.map((p:any,i:number)=>(
                            <tr key={p.id}><td className={styles.subText}>{i+1}</td><td>{p.title}</td><td style={{color:"#10b981",fontWeight:700}}>{p.sales_count||0}</td><td className={styles.subText}>{p.views_count||0}</td></tr>
                          ))}</tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}

              {tab==="vendors"&&(
                <div className={styles.sectionCard}>
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
                            <td><span style={{fontSize:"0.75rem",color:"#a78bfa"}}>{v.subscription_tier||"free"}</span></td>
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
                  <div className={styles.sectionHeader}><div><h2>Customers</h2><p>All users enrolled in your university</p></div></div>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead><tr><th>Customer</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
                      <tbody>
                        {filter(customers,["name","email","display_name"]).map((c:any)=>(
                          <tr key={c.id}>
                            <td><div style={{fontWeight:600}}>{c.display_name || c.name || c.email?.split('@')[0]}</div><div className={styles.subText}>{c.email}</div></td>
                            <td><span className={styles.badge}>{c.role}</span></td>
                            <td><span className={c.status==="active"?styles.badgeActive:styles.badgeOffline}>{c.status||"active"}</span></td>
                            <td>{new Date(c.created_at).toLocaleDateString()}</td>
                            <td>
                              <button className={styles.btnSm} onClick={()=>action("toggle_user_status",{userId:c.id,status:c.status==="active"?"suspended":"active"})}>
                                {c.status==="active"?"Suspend":"Activate"}
                              </button>
                            </td>
                          </tr>
                        ))}
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
                            <td style={{fontWeight:700,color:"#10b981"}}>₦{Number(o.total_amount).toLocaleString()}</td>
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
                            <td style={{color:"#f59e0b",fontWeight:700}}>{"★".repeat(r.rating)}</td>
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

                <div className={styles.sectionCard} style={{ marginTop: '2rem' }}>
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
                  <div className={styles.sectionHeader}><div><h2>University Analytics</h2><p>Order and revenue trends for your university</p></div></div>
                  <div style={{padding:"1.5rem"}}>
                    {chartData.length===0?<div className={styles.emptyState}><p>No data yet</p></div>:(
                      <>
                        <div style={{ width: '100%', height: 350, marginBottom: '2rem', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '12px' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                              <defs>
                                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                              <XAxis 
                                dataKey="time" 
                                stroke="#94a3b8" 
                                fontSize={12} 
                                tickLine={false} 
                                axisLine={false} 
                              />
                              <YAxis 
                                stroke="#94a3b8" 
                                fontSize={12} 
                                tickLine={false} 
                                axisLine={false} 
                                tickFormatter={(val) => `₦${val >= 1000 ? (val/1000).toFixed(0)+'k' : val}`}
                              />
                              <Tooltip 
                                contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
                                itemStyle={{ color: '#fff' }}
                              />
                              <Area 
                                type="monotone" 
                                dataKey="revenue" 
                                stroke="#10b981" 
                                fillOpacity={1} 
                                fill="url(#colorRev)" 
                                strokeWidth={3}
                                name="Revenue"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>

                        <div className={styles.tableWrap}>
                          <table className={styles.table}>
                            <thead><tr><th>Date</th><th>Orders</th><th>Revenue</th></tr></thead>
                            <tbody>{chartData.map((d:any)=>(
                              <tr key={d.time}>
                                <td>{d.time}</td>
                                <td style={{fontWeight:700}}>{d.orders}</td>
                                <td style={{color:"#10b981",fontWeight:700}}>₦{Number(d.revenue).toLocaleString()}</td>
                              </tr>
                            ))}</tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {tab==="insights"&&(
                <div className={styles.sectionCard}>
                  <div className={styles.sectionHeader}><div><h2>Cross-University Insights</h2><p>Read-only comparison across all universities</p></div></div>
                  <div className={styles.insightGrid}>
                    {insights.map((u:any)=>(
                      <div key={u.university_id} className={`${styles.insightCard} ${u.university_id===myUniversity?.id?styles.myUniversity:""}`}>
                        <div className={styles.insightName}>{u.university_name}</div>
                        <div className={styles.insightAbbr}>{u.abbreviation}</div>
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
                             <td style={{color:"#f59e0b",fontWeight:700}}>₦{Number(r.wallet_balance||0).toLocaleString()}</td>
                             <td>
                               <div className={styles.actionRow}>
                                 {!r.is_active && <button className={`${styles.btnSm} ${styles.btnApprove}`} onClick={()=>action("verify_rider",{userId:r.id})}><CheckCircle size={12}/> Verify</button>}
                                 {r.is_active && <button className={`${styles.btnSm} ${styles.btnReject}`} onClick={()=>{if(confirm('Revoke rider access?'))action("revoke_rider",{userId:r.id});}}><XCircle size={12}/> Revoke</button>}
                               </div>
                             </td>
                           </tr>
                         ))}
                        {riders.length===0&&<tr><td colSpan={6} style={{textAlign:"center",color:"#4a5568",padding:"2rem"}}>No riders assigned yet.</td></tr>}
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
                      <p>University administrative team &nbsp;<span style={{background:'rgba(99,102,241,0.15)',color:'#818cf8',padding:'2px 8px',borderRadius:'12px',fontSize:'0.7rem',fontWeight:700}}>{team.length}/10 Members</span></p>
                    </div>
                    {/* Only HEAD university_admin or super admin can add staff */}
                    {(userCtx?.role === "university_admin" || userCtx?.role === "admin") && team.length < 10 && (
                      <button className={styles.btnPrimary} onClick={()=>setShowAddStaff(true)}><UserPlus size={15}/>Add Staff</button>
                    )}
                    {team.length >= 10 && <span style={{color:'#ef4444',fontSize:'0.75rem',fontWeight:600}}>Team Full (10/10)</span>}
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
                    {team.length===0&&<div style={{padding:"2rem",color:"#4a5568"}}>No staff added yet. Use Add Staff to build your team (max 10).</div>}
                  </div>
                </div>
              )}

              {tab==="catalog"&&(
                <div className={styles.sectionCard}>
                  <div className={styles.sectionHeader}><div><h2>University Catalog</h2><p>Monitor and control all products listed in your university</p></div></div>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead><tr><th>Product</th><th>Brand</th><th>Visibility</th><th>Status</th><th>Stats</th><th>Actions</th></tr></thead>
                      <tbody>
                        {filter(products,["title"]).map((p:any)=>(
                          <tr key={p.id}>
                            <td>
                              <div className={styles.avatarCell}>
                                <img src={p.image_url||"/placeholder.png"} className={styles.prodThumb} />
                                <div><div style={{fontWeight:600}}>{p.title}</div><div className={styles.subText}>₦{p.price.toLocaleString()}</div></div>
                              </div>
                            </td>
                            <td>{p.brands?.name}</td>
                            <td>
                               <span className={styles.badge} style={{ 
                                  background: p.visibility_type === 'global' ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)', 
                                  color: p.visibility_type === 'global' ? '#818cf8' : 'var(--text-200)',
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
                      <p>Manage dynamic sections and automated rules for your students' homepage.</p>
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
                    <div className={styles.modalContent} style={{ maxWidth: '500px', background: 'var(--bg-100)', color: '#fff', borderRadius: '12px', border: '1px solid var(--border)' }}>
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
                     <div className={styles.modalContent} style={{ maxWidth: '800px', height: '80vh', background: 'var(--bg-100)', color: '#fff', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <div className={styles.modalHeader} style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h3 style={{ margin: 0 }}>Manage Products: {editingSection?.title}</h3>
                          <button className={styles.btnIcon} onClick={() => (document.getElementById('product-picker-modal') as any)?.close()}><XCircle size={20} /></button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', height: 'calc(100% - 70px)', padding: '1.5rem' }}>
                           <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden' }}>
                              <h4>University Catalog</h4>
                              <div className={styles.searchBar} style={{ width: '100%', background: 'var(--bg-200)' }}>
                                <Search size={14} />
                                <input placeholder="Filter products..." value={search} onChange={e => setSearch(e.target.value)} style={{ background: 'none', border: 'none', color: '#fff' }} />
                              </div>
                              <div style={{ overflowY: 'auto', flex: 1 }}>
                                 {filter(products, ['title']).slice(0, 50).map(p => (
                                   <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', padding: '0.75rem', background: 'var(--bg-200)', borderRadius: '8px' }}>
                                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                         <img src={p.image_url || p.media_urls?.[0]} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
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
            </>
          )}

        </div>
      </main>

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
                  <div style={{position:"absolute", top:"100%", left:0, right:0, background:"#1a1a2e", border:"1px solid var(--primary)", borderRadius:"8px", marginTop:"4px", zIndex:200, maxHeight:"200px", overflowY:"auto"}}>
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
                  {["vendors","customers","orders","reviews","fleet","notices"].map(p=>(
                    <label key={p} className={styles.permCheck}>
                      <input type="checkbox" checked={staffForm.permissions.includes(p)} onChange={e=>{
                        const next = e.target.checked ? [...staffForm.permissions,p] : staffForm.permissions.filter(x=>x!==p);
                        setStaffForm({...staffForm,permissions:next});
                      }}/>
                      {p.charAt(0).toUpperCase()+p.slice(1)}
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
    </div>
  );
}

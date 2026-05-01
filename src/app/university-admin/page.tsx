"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import styles from "./university-admin.module.css";
import {
  LayoutDashboard, Store, Users, ShoppingCart, Star, Bell,
  BarChart3, Globe, Truck, Shield, LogOut, RefreshCw, Search,
  CheckCircle, XCircle, Loader2, AlertTriangle, Plus, UserPlus, Trash2
} from "lucide-react";

type Tab = "overview"|"vendors"|"customers"|"orders"|"reviews"|"notices"|"analytics"|"insights"|"fleet"|"team"|"catalog";

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

  const [notifForm, setNotifForm] = useState({ title:"", content:"", target:"all" });
  const [notifSending, setNotifSending] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [staffForm, setStaffForm] = useState({ userId:"", staffRole:"university_staff", permissions:[] as string[] });
  const [addStaffLoading, setAddStaffLoading] = useState(false);
  const [orderFilter, setOrderFilter] = useState("all");

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/auth/login"); return; }
      const { data: profile } = await supabase.from("users").select("*, universities(*)").eq("id", session.user.id).single();
      if (profile) {
        setUserCtx(profile);
        setMyUniversity(profile.universities);
      }
    };
    init();
  }, [router]);

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const actions = ["stats","vendors","customers","orders","reviews","riders","analytics","cross_university_insights","team","products"];
      const results = await Promise.allSettled(actions.map(a => uaFetch(`/api/university-admin?action=${a}`)));
      const jsons = await Promise.allSettled(results.map((r,i) => r.status==="fulfilled"&&r.value.ok ? r.value.json() : Promise.resolve({})));
      const g = (i: number) => jsons[i].status==="fulfilled" ? (jsons[i] as any).value : {};
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
    } catch { setError("Failed to load dashboard data."); }
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
    ["orders","Orders",ShoppingCart],["reviews","Reviews",Star],["notices","Notices",Bell],
    ["analytics","Analytics",BarChart3],["insights","Insights",Globe],["fleet","Fleet",Truck],["team","My Team",Shield],
  ];

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
          {TABS.slice(0,5).map(([id,label,Icon]) => (
            <button key={id} className={`${styles.navItem} ${tab===id?styles.navActive:""}`} onClick={()=>{setTab(id);setSearch("");}}>
              <Icon size={17}/> {label}
              {id==="vendors"&&pendingVendors.length>0&&<span className={styles.navBadge}>{pendingVendors.length}</span>}
            </button>
          ))}
          <div className={styles.navGroup}>Communication</div>
          {TABS.slice(5,6).map(([id,label,Icon]) => (
            <button key={id} className={`${styles.navItem} ${tab===id?styles.navActive:""}`} onClick={()=>{setTab(id);setSearch("");}}>
              <Icon size={17}/> {label}
            </button>
          ))}
          <div className={styles.navGroup}>Analytics & Ops</div>
          {TABS.slice(6).map(([id,label,Icon]) => (
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
                      {label:"Revenue (₦)",val:`₦${(stats.totalRevenue||0).toLocaleString()}`,color:"#ec4899",bg:"rgba(236,72,153,0.1)"},
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
                            <td><div>{v.users?.name}</div><div className={styles.subText}>{v.users?.email}</div></td>
                            <td><span className={`${styles.badge} ${styles["badge"+v.verification_status?.charAt(0).toUpperCase()+v.verification_status?.slice(1)]||styles.badgePending}`}>{v.verification_status}</span></td>
                            <td><span style={{fontSize:"0.75rem",color:"#a78bfa"}}>{v.subscription_tier||"free"}</span></td>
                            <td>
                              <div className={styles.actionRow}>
                                {v.verification_status!=="verified"&&<button className={`${styles.btnSm} ${styles.btnApprove}`} onClick={()=>action("verify_vendor",{brandId:v.id})} disabled={!!actionLoading}><CheckCircle size={13}/>Verify</button>}
                                {v.verification_status!=="rejected"&&<button className={`${styles.btnSm} ${styles.btnReject}`} onClick={()=>{const r=prompt("Rejection reason:");if(r)action("reject_vendor",{brandId:v.id,reason:r});}} disabled={!!actionLoading}><XCircle size={13}/>Reject</button>}
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
                        {filter(customers,["name","email"]).map((c:any)=>(
                          <tr key={c.id}>
                            <td><div style={{fontWeight:600}}>{c.name}</div><div className={styles.subText}>{c.email}</div></td>
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
                            <td>{o.users?.name||"—"}</td>
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
                            <td>{r.users?.name||"—"}</td>
                            <td className={styles.subText}>{r.products?.title||r.brands?.name||"—"}</td>
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
              )}

              {tab==="analytics"&&(
                <div className={styles.sectionCard}>
                  <div className={styles.sectionHeader}><div><h2>University Analytics</h2><p>Order and revenue trends for your university</p></div></div>
                  <div style={{padding:"1.5rem"}}>
                    {chartData.length===0?<div className={styles.emptyState}><p>No data yet</p></div>:(
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
                      <thead><tr><th>Rider</th><th>Status</th><th>Deliveries</th><th>Balance</th></tr></thead>
                      <tbody>
                        {riders.map((r:any)=>(
                          <tr key={r.id}>
                            <td><div style={{fontWeight:600}}>{r.name}</div><div className={styles.subText}>{r.email}</div></td>
                            <td><span className={`${styles.badge} ${r.is_active?styles.badgeActive:styles.badgeOffline}`}>{r.is_active?"Online":"Offline"}</span></td>
                            <td>{r.completed_orders_count||0}</td>
                            <td style={{color:"#f59e0b",fontWeight:700}}>₦{Number(r.wallet_balance||0).toLocaleString()}</td>
                          </tr>
                        ))}
                        {riders.length===0&&<tr><td colSpan={4} style={{textAlign:"center",color:"#4a5568",padding:"2rem"}}>No riders assigned yet</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tab==="team"&&(
                <div className={styles.sectionCard}>
                  <div className={styles.sectionHeader}>
                    <div><h2>My Team</h2><p>Staff members helping administer your university</p></div>
                    <button className={styles.btnPrimary} onClick={()=>setShowAddStaff(true)}><UserPlus size={15}/>Add Staff</button>
                  </div>
                  <div className={styles.teamGrid}>
                    {team.map((m:any)=>(
                      <div key={m.id} className={styles.teamCard}>
                        <div className={styles.teamCardHeader}>
                          <div className={styles.teamAvatar}>{m.name?.charAt(0)?.toUpperCase()}</div>
                          <div>
                            <div style={{fontWeight:700}}>{m.name}</div>
                            <div className={styles.subText}>{m.email}</div>
                          </div>
                        </div>
                        <span className={`${styles.badge} ${m.role==="university_admin"?styles.badgeAdmin:styles.badgeStaff}`}>{m.role}</span>
                        {m.admin_permissions?.length>0&&(
                          <div className={styles.permsList}>{m.admin_permissions.map((p:string)=><span key={p} className={styles.permBadge}>{p}</span>)}</div>
                        )}
                        {userCtx?.role==="university_admin"&&m.role!=="university_admin"&&(
                          <button className={`${styles.btnSm} ${styles.btnReject}`} style={{marginTop:"0.75rem"}} onClick={()=>{if(confirm("Remove staff?"))action("remove_staff",{userId:m.id});}}><Trash2 size={13}/>Remove</button>
                        )}
                      </div>
                    ))}
                    {team.length===0&&<div style={{padding:"2rem",color:"#4a5568"}}>No staff added yet. Use Add Staff to grow your team.</div>}
                  </div>
                </div>
              )}

              {tab==="catalog"&&(
                <div className={styles.sectionCard}>
                  <div className={styles.sectionHeader}><div><h2>University Catalog</h2><p>Monitor and control all products listed in your university</p></div></div>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead><tr><th>Product</th><th>Brand</th><th>Status</th><th>Stats</th><th>Actions</th></tr></thead>
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
                            <td><span className={p.is_visible?styles.badgeActive:styles.badgeOffline}>{p.is_visible?"Visible":"Hidden"}</span></td>
                            <td className={styles.subText}>{p.sales_count} Sales / {p.views_count} Views</td>
                            <td>
                              <div className={styles.actionRow}>
                                <button className={styles.btnSm} onClick={()=>action("update_product",{productId:p.id,isVisible:!p.is_visible})}>{p.is_visible?"Hide":"Show"}</button>
                                <button className={`${styles.btnSm} ${p.is_featured?styles.btnApprove:""}`} onClick={()=>action("update_product",{productId:p.id,isFeatured:!p.is_featured})}>{p.is_featured?"Unfeature":"Feature"}</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
              <div>
                <label className={styles.formLabel}>User ID or Email</label>
                <input className={styles.formInput} placeholder="Paste user UUID..." value={staffForm.userId} onChange={e=>setStaffForm({...staffForm,userId:e.target.value})}/>
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

'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Users, 
  Store, 
  ShoppingBag, 
  TrendingUp, 
  CheckCircle, 
  XCircle, 
  Search,
  Settings,
  ShieldCheck,
  AlertCircle,
  FileText
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from './admin.module.css';

interface AdminStats {
  usersCount: number;
  brandsCount: number;
  productsCount: number;
  totalRevenue: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats>({
    usersCount: 0,
    brandsCount: 0,
    productsCount: 0,
    totalRevenue: 0
  });
  
  const [activeTab, setActiveTab] = useState<'overview' | 'vendors' | 'products' | 'users'>('overview');
  const [vendors, setVendors] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAdminData() {
      setLoading(true);
      
      const { count: uCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
      const { count: bCount } = await supabase.from('brands').select('*', { count: 'exact', head: true });
      const { count: pCount } = await supabase.from('products').select('*', { count: 'exact', head: true });
      
      setStats({
        usersCount: uCount || 0,
        brandsCount: bCount || 0,
        productsCount: pCount || 0,
        totalRevenue: 1250000 
      });

      const { data: vData } = await supabase.from('brands').select('*').order('created_at', { ascending: false });
      setVendors(vData || []);

      const { data: pData } = await supabase.from('products').select('*, brands(name)').order('created_at', { ascending: false });
      setProducts(pData || []);

      setLoading(false);
    }
    fetchAdminData();
  }, []);

  const toggleVerification = async (brandId: string, currentStatus: boolean) => {
    const { error } = await supabase.from('brands').update({ verified: !currentStatus }).eq('id', brandId);
    if (!error) setVendors(prev => prev.map(v => v.id === brandId ? { ...v, verified: !currentStatus } : v));
  };

  const deleteProduct = async (productId: string) => {
    if (!confirm('Remove this product from the platform?')) return;
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (!error) setProducts(prev => prev.filter(p => p.id !== productId));
  };

  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logo}>AF ADMIN</div>
          <p>Super-Admin Control</p>
        </div>
        
        <nav className={styles.nav}>
          <button className={`${styles.navItem} ${activeTab === 'overview' ? styles.navActive : ''}`} onClick={() => setActiveTab('overview')}><TrendingUp size={18} /> Overview</button>
          <button className={`${styles.navItem} ${activeTab === 'vendors' ? styles.navActive : ''}`} onClick={() => setActiveTab('vendors')}><Store size={18} /> Vendors</button>
          <button className={`${styles.navItem} ${activeTab === 'products' ? styles.navActive : ''}`} onClick={() => setActiveTab('products')}><ShoppingBag size={18} /> Catalog</button>
          <button className={`${styles.navItem} ${activeTab === 'users' ? styles.navActive : ''}`} onClick={() => setActiveTab('users')}><Users size={18} /> Users</button>
        </nav>

        <div className={styles.sidebarFooter}>
          <Link href="/" className={styles.exitLink}>Back to Hub</Link>
        </div>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <h1>Admin {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h1>
          <div className={styles.headerActions}>
            <div className={styles.searchBar}><Search size={16} /><input type="text" placeholder="Search..." /></div>
            <button className="btn btn-ghost btn-icon"><Settings size={20} /></button>
          </div>
        </header>

        {activeTab === 'overview' && (
          <div className={styles.content}>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statInfo}><p>Users</p><h3>{stats.usersCount}</h3></div>
                <div className={styles.statIcon} style={{color: '#3b82f6'}}><Users size={22} /></div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statInfo}><p>Brands</p><h3>{vendors.length}</h3></div>
                <div className={styles.statIcon} style={{color: '#10b981'}}><Store size={22} /></div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statInfo}><p>Products</p><h3>{stats.productsCount}</h3></div>
                <div className={styles.statIcon} style={{color: '#c9a14a'}}><ShoppingBag size={22} /></div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statInfo}><p>Revenue</p><h3>₦{stats.totalRevenue.toLocaleString()}</h3></div>
                <div className={styles.statIcon} style={{color: '#eb0c7a'}}><TrendingUp size={22} /></div>
              </div>
            </div>

            <div className={styles.sectionsGrid}>
              <section className={styles.sectionCard}>
                <h3>Verification Requests</h3>
                <div className={styles.pList}>
                  {vendors.slice(0, 5).map(v => (
                    <div key={v.id} className={styles.pItem}>
                      <div className={styles.pInfo}>
                        <h4>{v.name}</h4>
                        <p>{v.verified ? 'Verified' : 'Pending Review'}</p>
                      </div>
                      <button className={`btn btn-sm ${v.verified ? 'btn-ghost' : 'btn-primary'}`} onClick={() => toggleVerification(v.id, v.verified)}>
                        {v.verified ? 'Revoke' : 'Approve'}
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <section className={styles.sectionCard}>
                <h3>Platform Health</h3>
                <div className={styles.healthStats}>
                  <div className={styles.healthItem}><AlertCircle size={16} /><span>3 Pending Reports</span></div>
                  <div className={styles.healthItem}><FileText size={16} /><span>System: Stable</span></div>
                  <div className={styles.healthItem}><ShieldCheck size={16} /><span>Firewall Active</span></div>
                </div>
              </section>
            </div>
          </div>
        )}

        {activeTab === 'vendors' && (
          <div className={styles.content}>
             <div className={styles.sectionCard}>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead><tr><th>Brand</th><th>WhatsApp</th><th>Status</th><th>Action</th></tr></thead>
                    <tbody>
                      {vendors.map(v => (
                        <tr key={v.id}>
                          <td>{v.name}</td>
                          <td>{v.whatsapp_number}</td>
                          <td>{v.verified ? '✅ Verified' : '⏳ Pending'}</td>
                          <td><button className="btn btn-ghost btn-sm" onClick={() => toggleVerification(v.id, v.verified)}>{v.verified ? 'Revoke' : 'Verify'}</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className={styles.content}>
             <div className={styles.sectionCard}>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead><tr><th>Product</th><th>Brand</th><th>Price</th><th>Action</th></tr></thead>
                    <tbody>
                      {products.map(p => (
                        <tr key={p.id}>
                          <td>{p.title}</td>
                          <td>{p.brands?.name}</td>
                          <td>₦{p.price.toLocaleString()}</td>
                          <td><button className="btn btn-ghost btn-sm text-error" onClick={() => deleteProduct(p.id)}>Remove</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
          </div>
        )}
      </main>
    </div>
  );
}

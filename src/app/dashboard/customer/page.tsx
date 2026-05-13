'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ShoppingBag, Truck, CheckCircle, Clock, Loader2, ArrowRight, MessageCircle, Bell, User, Camera } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/lib/utils';
import styles from './customer.module.css';

interface AppOrder {
  id: string;
  created_at: string;
  status: string;
  total_amount: string | number;
  delivery_method?: string;
  delivery_code?: string;
  products?: { title: string; media_urls?: string[] };
  brands?: { name: string };
  deliveries?: { 
    id: string;
    status: string;
    agent_id?: string;
    delivery_code?: string; 
    users?: { name?: string; phone?: string } 
  }[];
}

interface AppEnquiry {
  id: string;
  content: string;
  receiver?: { name: string };
}

interface AppUser {
  id: string;
  email?: string;
  avatar_url?: string;
}

export default function CustomerDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<AppOrder[]>([]);
  const [enquiries, setEnquiries] = useState<AppEnquiry[]>([]);
  const [user, setUser] = useState<AppUser | null>(null);

  useEffect(() => {
    async function fetchOrders() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/login?redirect=/dashboard/customer');
        return;
      }
      setUser(session.user);

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          products (title, media_urls),
          brands (name, delivery_scope),
          deliveries (
            id,
            status,
            agent_id,
            delivery_code,
            users:agent_id (id, name, phone)
          )
        `)
        .eq('customer_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) console.error(error);
      setOrders((data as unknown as AppOrder[]) || []);

      // Fetch Enquiries
      const { data: enqData } = await supabase
        .from('messages')
        .select('*, receiver:receiver_id(name)')
        .eq('sender_id', session.user.id)
        .order('created_at', { ascending: false });
      
      setEnquiries((enqData as unknown as AppEnquiry[]) || []);
      setLoading(false);
    }
    fetchOrders();
  }, [router]);

  const handleConfirmDelivery = async (orderId: string) => {
    if (!window.confirm('Confirm that you have received this item? This will release payment to the vendor.')) return;
    
    setLoading(true);
    try {
      const res = await fetch('/api/orders/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, userId: user?.id })
      });
      const data = await res.json();
      
      if (data.success) {
        // Refresh orders
        const { data: updatedOrders } = await supabase
          .from('orders')
          .select('*, products(title, media_urls), brands(name)')
          .eq('customer_id', user?.id)
          .order('created_at', { ascending: false });
        setOrders((updatedOrders as unknown as AppOrder[]) || []);
        alert('Payment released! Thank you for shopping with Master Cart.');
      } else {
        alert(data.error || 'Failed to confirm delivery.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error occurred.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && orders.length === 0) {
    return (
      <div className={styles.loading}>
        <Loader2 className="anim-spin" size={32} />
        <p>Fetching your orders...</p>
      </div>
    );
  }

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Welcome, {user?.email?.split('@')[0]}</h1>
          <p className={styles.subtitle}>Track your purchases and view delivery status.</p>
        </div>
        <Link href="/explore" className="btn btn-primary btn-sm">
          <ShoppingBag size={16} /> Continue Shopping
        </Link>
      </div>

      <div className={styles.dashboardGrid}>
        {/* Main: Orders */}
        <div className={styles.mainCol}>
          <h2 className={styles.sectionTitle}>Your Orders</h2>
          
          {orders.length === 0 ? (
            <div className={`card ${styles.empty}`}>
              <ShoppingBag size={48} className={styles.emptyIcon} />
              <h3>No orders yet</h3>
              <p>Items you buy will appear here for tracking.</p>
              <Link href="/explore" className="btn btn-secondary">Explore Marketplace</Link>
            </div>
          ) : (
            <div className={styles.orderList}>
              {orders.map((order) => (
                <div key={order.id} className={`card ${styles.orderCard}`}>
                  <div className={styles.orderHeader}>
                    <div>
                      <span className={styles.orderId}>Order #{order.id.slice(0, 8).toUpperCase()}</span>
                      <span className={styles.orderDate}>{new Date(order.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className={`${styles.statusBadge} ${styles[order.status]}`}>
                       {order.status === 'paid' && <Clock size={14} />}
                       {order.status === 'in_transit' && <Truck size={14} />}
                       {order.status === 'delivered' && <CheckCircle size={14} />}
                       {order.status.replace('_', ' ').toUpperCase()}
                    </div>
                  </div>

                  <div className={styles.orderBody}>
                    <div className={styles.itemImg}>
                      <Image src={order.products?.media_urls?.[0] || '/placeholder.png'} alt={order.products?.title || 'Product'} width={100} height={100} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div className={styles.itemInfo}>
                      <h3>{order.products?.title}</h3>
                      <p>Seller: {order.brands?.name}</p>
                      <span className={styles.price}>{formatPrice(Number(order.total_amount))}</span>
                    </div>
                    <div className={styles.actions}>
                      <Link href={`/track/${order.id}`} className="btn btn-ghost btn-sm">
                        Track Delivery
                      </Link>
                      {/* Manual confirmation is ONLY for non-platform deliveries (legacy/vendor handle) */}
                      {order.status === 'in_transit' && order.delivery_method !== 'platform' && (
                        <button 
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleConfirmDelivery(order.id)}
                        >
                          Confirm Receipt
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Live Status Timeline */}
                  <div className={styles.timelineContainer} style={{ padding: '0 1.5rem 1rem' }}>
                    <div className={styles.timeline}>
                      {['paid', 'preparing', 'ready', 'picked_up', 'in_transit', 'delivered'].map((step, idx) => {
                        const statuses = ['paid', 'preparing', 'ready', 'picked_up', 'in_transit', 'delivered'];
                        const currentIdx = statuses.indexOf(order.status);
                        const isCompleted = idx <= currentIdx;
                        const isActive = idx === currentIdx;
                        
                        return (
                          <div key={step} className={`${styles.timelineStep} ${isCompleted ? styles.completed : ''} ${isActive ? styles.active : ''}`}>
                            <div className={styles.stepCircle}>
                              {isCompleted ? <CheckCircle size={10} /> : <div className={styles.dot} />}
                            </div>
                            <span className={styles.stepLabel}>{step.replace('_', ' ')}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {order.delivery_code && order.status !== 'delivered' && (
                    <div className={styles.deliveryCodeCard} style={{ margin: '0 1.5rem 1rem', background: 'var(--bg-200)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--primary-20)', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', top: 0, right: 0, padding: '4px 12px', background: 'var(--primary)', color: '#fff', fontSize: '10px', fontWeight: 800, borderRadius: '0 0 0 8px' }}>SECRET CODE</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-400)' }}>Verification Code</p>
                          <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 900, color: 'var(--primary)', letterSpacing: '4px' }}>{order.delivery_code}</h2>
                        </div>
                        <button 
                          className="btn btn-ghost btn-sm" 
                          onClick={() => {
                            navigator.clipboard.writeText(order.delivery_code!);
                            alert('Code copied to clipboard!');
                          }}
                        >
                          Copy
                        </button>
                      </div>
                      <p style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--text-400)', fontStyle: 'italic' }}>
                        Give this code to the delivery agent only after inspecting your items.
                      </p>
                    </div>
                  )}

                  {order.deliveries?.[0] && order.deliveries[0].agent_id && (
                    <div className={styles.agentInfo} style={{ margin: '0 1.5rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'var(--bg-300)', borderRadius: '12px' }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--primary-10)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                        <Truck size={20} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-400)', textTransform: 'uppercase', fontWeight: 700 }}>Assigned Agent</p>
                        <p style={{ margin: 0, fontWeight: 700 }}>{order.deliveries[0].users?.name || 'Logistic Partner'}</p>
                      </div>
                      <a href={`tel:${order.deliveries[0].users?.phone}`} className="btn btn-primary btn-sm" style={{ padding: '8px' }}>
                        <MessageCircle size={16} />
                      </a>
                    </div>
                  )}

                  {order.status === 'paid' && !order.deliveries?.[0] && (
                    <div className={styles.escrowBanner} style={{ margin: '0 1.5rem 1.5rem' }}>
                      <Clock size={14} />
                      <span>Secured in Escrow. Waiting for vendor to prepare.</span>
                    </div>
                  )}

                  {/* External Delivery Window Notice */}
                  {(order.brands as any)?.delivery_scope === 'out-school' && order.status !== 'delivered' && (
                    <div style={{ 
                      margin: '0 1.5rem 1.5rem', 
                      padding: '0.75rem 1rem', 
                      background: 'rgba(235, 12, 122, 0.05)', 
                      border: '1px dashed var(--primary-40)', 
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      color: 'var(--primary)'
                    }}>
                      <Clock size={16} />
                      <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                        External Order Window: <span style={{ opacity: 0.8 }}>Estimated delivery is 5 days from order date.</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar: Profile/Summary */}
        <div className={styles.sideCol}>
          <div className={`card ${styles.statsCard}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
               <div style={{ position: 'relative' }}>
                 {user?.avatar_url ? (
                   <Image src={user.avatar_url} alt="" width={64} height={64} style={{ borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }} />
                 ) : (
                   <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-300)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                     <User size={32} color="var(--text-400)" />
                   </div>
                 )}
                 <label style={{ position: 'absolute', bottom: -5, right: -5, background: 'var(--primary)', color: '#fff', borderRadius: '50%', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                   <input 
                     type="file" 
                     hidden 
                     accept="image/*" 
                     onChange={async (e) => {
                       if (!e.target.files?.[0]) return;
                       const file = e.target.files[0];
                       const { uploadFile } = await import('@/lib/storage');
                       setLoading(true);
                       const { url, error } = await uploadFile(file, 'brand-assets', `avatar-${user?.id}`);
                       if (url) {
                         await supabase.from('users').update({ avatar_url: url }).eq('id', user?.id);
                         setUser((prev: AppUser | null) => prev ? { ...prev, avatar_url: url } : null);
                         alert('Profile photo updated!');
                       } else {
                         alert(error || 'Upload failed');
                       }
                       setLoading(false);
                     }} 
                   />
                   <Camera size={14} />
                 </label>
               </div>
               <div>
                 <h3 style={{ margin: 0 }}>{user?.email?.split('@')[0]}</h3>
                 <p style={{ fontSize: '0.8rem', color: 'var(--text-400)', margin: 0 }}>Customer Account</p>
               </div>
            </div>
            
            <h3>Account Summary</h3>
            <div className={styles.statLine}>
              <span>Purchases</span>
              <span>{orders.length}</span>
            </div>
            <div className={styles.statLine}>
              <span>Total Spent</span>
              <span>{formatPrice(orders.reduce((acc, curr) => acc + Number(curr.total_amount), 0))}</span>
            </div>
          </div>
          
          <Link href="/wishlist" className={`card ${styles.wishlistCard}`}>
            <div className={styles.wishlistInfo}>
              <h3>Your Wishlist</h3>
              <p>Items you saved for later</p>
            </div>
            <ArrowRight size={20} />
          </Link>

          <button 
            className={`card ${styles.logoutCard}`}
            onClick={async () => {
              await supabase.auth.signOut();
              router.push('/');
            }}
          >
            <div className={styles.logoutInfo}>
              <h3>Sign Out</h3>
              <p>Protect your account security</p>
            </div>
            <ArrowRight size={20} />
          </button>

          <div className={`card ${styles.enquiryCardSmall}`}>
            <div className={styles.sectionHeaderIcon}>
              <Bell size={18} className={styles.goldIcon} />
              <h3>Notifications & Enquiries</h3>
            </div>
            <div className={styles.enquiryBriefList}>
              {enquiries.slice(0, 3).map(enq => (
                <div key={enq.id} className={styles.enquiryBriefItem}>
                  <MessageCircle size={14} className={styles.enquiryIcon} />
                  <div className={styles.enquiryBriefInfo}>
                    <p>{enq.receiver?.name}</p>
                    <span>{enq.content.split(': ')[1]?.substring(0, 25) || enq.content.substring(0, 25)}...</span>
                  </div>
                </div>
              ))}
              {enquiries.length === 0 && <p className={styles.emptyText}>No active notifications.</p>}
              <Link href="/notifications" className={styles.viewAllLink}>
                View all notifications <ArrowRight size={12} />
              </Link>
            </div>
          </div>

          <Link href="/onboarding" className={`card ${styles.vendorCard}`} style={{ background: 'linear-gradient(135deg, var(--bg-200), var(--bg-300))', border: '1px solid var(--border)', marginTop: '1.5rem' }}>
            <div className={styles.vendorInfo}>
              <h3 style={{ color: 'var(--primary)', marginBottom: '0.25rem' }}>Sell on Master Cart</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-400)' }}>Open your campus boutique and grow your brand vividly.</p>
            </div>
            <ArrowRight size={20} color="var(--primary)" />
          </Link>
        </div>
      </div>
    </div>
  );
}

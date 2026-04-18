'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShoppingBag, Truck, CheckCircle, Clock, Package, Loader2, ArrowRight, MessageCircle, Bell } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/lib/utils';
import styles from './customer.module.css';

export default function CustomerDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);

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
          brands (name)
        `)
        .eq('customer_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) console.error(error);
      setOrders(data || []);

      // Fetch Enquiries
      const { data: enqData } = await supabase
        .from('messages')
        .select('*, receiver:receiver_id(name)')
        .eq('sender_id', session.user.id)
        .order('created_at', { ascending: false });
      
      setEnquiries(enqData || []);
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
        body: JSON.stringify({ orderId, userId: user.id })
      });
      const data = await res.json();
      
      if (data.success) {
        // Refresh orders
        const { data: updatedOrders } = await supabase
          .from('orders')
          .select('*, products(title, media_urls), brands(name)')
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false });
        setOrders(updatedOrders || []);
        alert('Payment released! Thank you for shopping with ABUAD Fashion Hub.');
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
                      <img src={order.products?.media_urls?.[0]} alt={order.products?.title} />
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
                      {order.status === 'delivered' && (
                        <button 
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleConfirmDelivery(order.id)}
                        >
                          Confirm Delivery
                        </button>
                      )}
                    </div>
                  </div>

                  {order.status === 'paid' && (
                    <div className={styles.escrowBanner}>
                      <Clock size={14} />
                      <span>Funds held in Escrow. Vendor is processing your order.</span>
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
        </div>
      </div>
    </div>
  );
}

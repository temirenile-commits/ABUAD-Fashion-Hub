'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Bell, 
  MessageCircle, 
  Tag, 
  Zap, 
  User, 
  ArrowRight, 
  ShoppingBag,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/lib/utils';
import styles from './notifications.module.css';

interface ProductNotification {
  id: string;
  type: 'enquiry_reply' | 'price_drop' | 'vendor_update' | 'recommendation';
  title: string;
  content: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<ProductNotification[]>([]);
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    async function fetchData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }
      setUser(session.user);

      // 1. Fetch Enquiries from existing messages table
      const { data: enquiryData } = await supabase
        .from('messages')
        .select('*, sender:sender_id(name), receiver:receiver_id(name)')
        .or(`sender_id.eq.${session.user.id},receiver_id.eq.${session.user.id}`)
        .order('created_at', { ascending: false });

      setEnquiries(enquiryData || []);

      // 2. SMART LOGIC: Generate recommendations based on enquiries
      const enquiredTitles = enquiryData?.map(e => {
        const match = e.content.match(/\[Enquiry about (.*?)\]/);
        return match ? match[1] : null;
      }).filter(Boolean) || [];

      if (enquiredTitles.length > 0) {
        // Find categories for these titles
        const { data: prodData } = await supabase
          .from('products')
          .select('category')
          .in('title', enquiredTitles);
        
        const categories = [...new Set(prodData?.map(p => p.category))];
        
        if (categories.length > 0) {
          // Fetch recommendations
          const { data: recs } = await supabase
            .from('products')
            .select('*')
            .in('category', categories)
            .limit(3);
          
          if (recs && recs.length > 0) {
             const recNotifs = recs.map(r => ({
               id: r.id,
               type: 'recommendation' as const,
               title: 'Recommended for You',
               content: `We found a new "${r.title}" in ${r.category} you might like!`,
               link: `/product/${r.id}`,
               is_read: false,
               created_at: new Date().toISOString()
             }));
             setNotifications(prev => [...recNotifs, ...prev]);
          }
        }
      }

      // 3. Fetch notifications from new notifications table
      const { data: notifyData } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (notifyData && notifyData.length > 0) {
        setNotifications(prev => [...notifyData, ...prev]);
      }
      
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) return <div className="container" style={{padding: '4rem', textAlign: 'center'}}><h2>Loading your hub...</h2></div>;
  if (!user) return <div className="container" style={{padding: '4rem', textAlign: 'center'}}><h2>Please login to view notifications</h2><Link href="/auth/login" className="btn btn-primary">Login</Link></div>;

  return (
    <main className={styles.container}>
      <div className="container-wide">
        <header className={styles.header}>
          <div className={styles.titleGroup}>
            <Bell size={24} className={styles.goldIcon} />
            <h1>Notifications & Updates</h1>
          </div>
          <p className={styles.subtitle}>Track your enquired products, price drops, and vendor updates.</p>
        </header>

        <div className={styles.grid}>
          {/* Main Feed */}
          <section className={styles.feed}>
            <div className={styles.sectionHead}>
              <h3>Latest Activity</h3>
              <button className={styles.clearBtn}>Mark all as read</button>
            </div>

            {notifications.length === 0 && enquiries.length === 0 ? (
              <div className={styles.empty}>
                <Zap size={48} className={styles.zapIcon} />
                <p>No notifications yet. Enquire about products to start receiving updates!</p>
              </div>
            ) : (
              <div className={styles.list}>
                {notifications.map((n) => (
                  <Link key={n.id} href={n.link} className={`${styles.item} ${!n.is_read ? styles.unread : ''}`}>
                    <div className={styles.iconBox}>
                      {n.type === 'price_drop' && <Tag size={18} />}
                      {n.type === 'vendor_update' && <User size={18} />}
                      {n.type === 'recommendation' && <Zap size={18} />}
                    </div>
                    <div className={styles.content}>
                      <div className={styles.itemHeader}>
                        <h4>{n.title}</h4>
                        <span className={styles.time}>{new Date(n.created_at).toLocaleDateString()}</span>
                      </div>
                      <p>{n.content}</p>
                    </div>
                    <ArrowRight size={16} className={styles.arrow} />
                  </Link>
                ))}

                {enquiries.map((e) => (
                  <Link key={e.id} href={`/messages`} className={styles.item}>
                    <div className={styles.iconBoxEnquiry}>
                      <MessageCircle size={18} />
                    </div>
                    <div className={styles.content}>
                      <div className={styles.itemHeader}>
                        <h4>Enquiry Reply</h4>
                        <span className={styles.time}>{new Date(e.created_at).toLocaleTimeString()}</span>
                      </div>
                      <p>{e.content.length > 60 ? e.content.substring(0, 60) + '...' : e.content}</p>
                    </div>
                    <CheckCircle2 size={16} className={styles.check} />
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Recommendations Sidebar */}
          <aside className={styles.sidebar}>
             <div className={styles.promoCard}>
               <ShoppingBag size={24} className={styles.goldIcon} />
               <h4>Suggested for You</h4>
               <p>Based on your wishlist and enquiries.</p>
               <Link href="/explore" className="btn btn-primary btn-sm" style={{width: '100%', marginTop: '1rem'}}>
                 Shop More
               </Link>
             </div>

             <div className={styles.helpBox}>
                <h4>Need Help?</h4>
                <p>Chat with our support team on WhatsApp.</p>
                <Link href="https://wa.me/2347045592604" target="_blank" className="btn btn-secondary btn-sm" style={{width: '100%', marginTop: '1rem'}}>
                   Open Support
                </Link>
             </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

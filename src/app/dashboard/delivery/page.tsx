'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Zap, 
  MapPin, 
  Package, 
  CheckCircle, 
  Clock, 
  Wallet, 
  Truck, 
  User, 
  LogOut, 
  Settings,
  Navigation,
  FileText,
  Phone,
  LayoutDashboard,
  Bell,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/lib/utils';
import styles from './delivery.module.css';

export default function DeliveryDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [agent, setAgent] = useState<any>(null);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [availableDeliveries, setAvailableDeliveries] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('queue');
  const [verificationCode, setVerificationCode] = useState('');
  const [processingCode, setProcessingCode] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Fetch My Deliveries
    const { data: myData } = await supabase
      .from('deliveries')
      .select(`
        *,
        orders (
          id,
          total_amount,
          shipping_address,
          customer_id,
          users:customer_id (name, phone),
          brands (name, latitude, longitude, location_name, whatsapp_number)
        )
      `)
      .eq('agent_id', session.user.id)
      .neq('status', 'delivered')
      .order('created_at', { ascending: false });

    // Fetch Available Deliveries (Pending and no agent)
    const { data: availData } = await supabase
      .from('deliveries')
      .select(`
        *,
        orders (
          id,
          total_amount,
          shipping_address,
          brands (name, location_name)
        )
      `)
      .is('agent_id', null)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    setDeliveries(myData || []);
    setAvailableDeliveries(availData || []);
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/login?redirect=/dashboard/delivery');
        return;
      }

      const { data: userData } = await supabase.from('users').select('role, name').eq('id', session.user.id).single();
      if (userData?.role !== 'delivery' && userData?.role !== 'admin') {
        router.push('/dashboard/customer');
        return;
      }

      const { data: agentData } = await supabase
        .from('delivery_agents')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (!agentData) {
        const { data: newAgent } = await supabase.from('delivery_agents').insert({ id: session.user.id }).select().single();
        setAgent({ ...newAgent, name: userData.name });
      } else {
        setAgent({ ...agentData, name: userData.name });
      }

      await fetchData();
    }
    init();

    // Set up Realtime for new available orders
    const channel = supabase
      .channel('available-deliveries')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, () => fetchData(true))
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [router]);

  // GPS Tracking Loop
  useEffect(() => {
    let interval: any;
    if (agent?.id && agent?.is_active) {
      const updateLocation = () => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(async (pos) => {
            const { latitude, longitude } = pos.coords;
            
            // Update Agent Profile
            await supabase.from('delivery_agents').update({ 
              current_lat: latitude, 
              current_long: longitude,
              last_active_at: new Date().toISOString()
            }).eq('id', agent.id);

            // Update Active Deliveries for Live Map (Picked up / In Transit)
            const activeIds = deliveries
              .filter(d => ['picked_up', 'in_transit', 'assigned'].includes(d.status))
              .map(d => d.id);

            if (activeIds.length > 0) {
              await supabase.from('deliveries').update({ 
                live_location_lat: latitude, 
                live_location_lng: longitude,
                last_updated_at: new Date().toISOString()
              }).in('id', activeIds);
            }
          });
        }
      };
      updateLocation();
      interval = setInterval(updateLocation, 30000); // 30 second precision for live map
    }
    return () => clearInterval(interval);
  }, [agent?.id, agent?.is_active, deliveries]);

  const toggleActive = async () => {
    const newStatus = !agent.is_active;
    const { error } = await supabase.from('delivery_agents').update({ is_active: newStatus, last_active_at: new Date().toISOString() }).eq('id', agent.id);
    if (!error) setAgent({ ...agent, is_active: newStatus });
  };

  const updateCapacity = async (val: number) => {
    const { error } = await supabase.from('delivery_agents').update({ batch_capacity: val }).eq('id', agent.id);
    if (!error) setAgent({ ...agent, batch_capacity: val });
  };

  const claimDelivery = async (deliveryId: string) => {
    if (!agent.is_active) {
      alert('You must be ONLINE to accept orders.');
      return;
    }
    setProcessingCode(deliveryId);
    const { error } = await supabase
      .from('deliveries')
      .update({ agent_id: agent.id, status: 'assigned' })
      .eq('id', deliveryId)
      .is('agent_id', null); // Safety check: only if still unassigned

    if (!error) {
      alert('Order accepted! Head to the vendor for pickup.');
      await fetchData(true);
      setActiveTab('queue');
    } else {
      alert('This order was already claimed by another agent.');
    }
    setProcessingCode(null);
  };

  const verifyDelivery = async (deliveryId: string) => {
    if (!verificationCode) return;
    setProcessingCode(deliveryId);

    const delivery = deliveries.find(d => d.id === deliveryId);
    if (delivery.delivery_code !== verificationCode) {
      alert('Invalid delivery code! Please check with the customer.');
      setProcessingCode(null);
      return;
    }

    const { error } = await supabase.from('deliveries').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('id', deliveryId);
    if (!error) {
      setDeliveries(deliveries.filter(d => d.id !== deliveryId));
      setAgent((prev: any) => ({ ...prev, wallet_balance: Number(prev.wallet_balance) + 500 }));
      setVerificationCode('');
      alert('Delivery successful! ₦500 has been added to your wallet.');
    } else {
      alert('Error updating delivery status.');
    }
    setProcessingCode(null);
  };

  const updateStatus = async (deliveryId: string, newStatus: string) => {
    const { error } = await supabase.from('deliveries').update({ status: newStatus, picked_up_at: newStatus === 'picked_up' ? new Date().toISOString() : null }).eq('id', deliveryId);
    if (!error) {
      setDeliveries(deliveries.map(d => d.id === deliveryId ? { ...d, status: newStatus } : d));
    }
  };

  if (loading) return <div className={styles.spinnerWrap}><Loader2 className="anim-spin" size={48} /></div>;

  return (
    <div className={`container ${styles.page}`}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.agentCard}>
          <div className={styles.avatar}>{agent.name?.[0] || 'A'}</div>
          <h3 className={styles.agentName}>{agent.name}</h3>
          <p className={styles.agentBadge}>Delivery Partner</p>
          
          <button 
            className={`${styles.statusToggle} ${agent.is_active ? styles.statusOnline : styles.statusOffline}`}
            onClick={toggleActive}
          >
            <Zap size={18} fill={agent.is_active ? "currentColor" : "none"} />
            {agent.is_active ? 'ONLINE - RECEIVING ORDERS' : 'OFFLINE - ON BREAK'}
          </button>
        </div>

        <div className={styles.card}>
          <h4 className={styles.cardTitle}>Settings</h4>
          <div style={{ marginTop: '1rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-400)' }}>Batch Capacity (10-50)</label>
            <input 
              type="number" 
              className={styles.capacityInput} 
              value={agent.batch_capacity || 10} 
              onChange={(e) => updateCapacity(parseInt(e.target.value))}
              min="10"
              max="50"
            />
          </div>
        </div>

        <div className={styles.card} style={{ borderLeft: '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Wallet size={20} color="var(--primary)" />
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-400)' }}>Wallet Balance</span>
              <h3 style={{ fontSize: '1.5rem' }}>{formatPrice(agent.wallet_balance || 0)}</h3>
            </div>
          </div>
        </div>

        <button className="btn btn-ghost w-full" onClick={() => supabase.auth.signOut()}>
          <LogOut size={18} /> Logout
        </button>
      </aside>

      {/* Main Content */}
      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Dispatch Console</h1>
            <p className={styles.subtitle}>Manage your active delivery batches and confirm drop-offs.</p>
          </div>
          <button className={styles.refreshBtn} onClick={() => fetchData(true)} disabled={refreshing}>
            <RefreshCw size={18} className={refreshing ? 'anim-spin' : ''} />
          </button>
        </div>

        <div className={styles.tabs}>
          <button className={`${styles.tab} ${activeTab === 'available' ? styles.tabActive : ''}`} onClick={() => setActiveTab('available')}>
            Available ({availableDeliveries.length})
          </button>
          <button className={`${styles.tab} ${activeTab === 'queue' ? styles.tabActive : ''}`} onClick={() => setActiveTab('queue')}>
            My Batch ({deliveries.length})
          </button>
          <button className={`${styles.tab} ${activeTab === 'history' ? styles.tabActive : ''}`} onClick={() => setActiveTab('history')}>
            History
          </button>
        </div>

        {activeTab === 'available' && (
          <div className={styles.deliveryList}>
            {availableDeliveries.length === 0 ? (
              <div className={styles.emptyState}>
                <Truck size={48} className="anim-float" />
                <h3>No Orders Nearby</h3>
                <p>New orders will appear here automatically. Stay online!</p>
              </div>
            ) : (
              availableDeliveries.map((delivery) => (
                <div key={delivery.id} className={styles.deliveryItem} style={{ borderLeft: '4px solid var(--primary)' }}>
                  <div className={styles.deliveryHeader}>
                    <div>
                      <span className={styles.orderId}>#NEW-{delivery.order_id.slice(0, 8)}</span>
                      <div className={styles.tags}>
                         <span className={styles.badge} style={{ background: 'rgba(34, 197, 94, 0.1)', color: 'var(--success)' }}>₦1,500 Delivery Fee</span>
                      </div>
                    </div>
                    <div className={styles.price}>₦500 Earning</div>
                  </div>
                  
                  <div className={styles.grid}>
                    <div className={styles.infoBlock}>
                      <h5><MapPin size={14} /> Pickup</h5>
                      <p><strong>{delivery.orders?.brands?.name}</strong></p>
                      <p style={{ fontSize: '0.85rem' }}>{delivery.orders?.brands?.location_name}</p>
                    </div>
                    <div className={styles.infoBlock}>
                      <h5><Navigation size={14} /> Destination</h5>
                      <p style={{ fontSize: '0.85rem' }}>{delivery.orders?.shipping_address}</p>
                    </div>
                  </div>

                  <button 
                    className="btn btn-primary w-full" 
                    style={{ marginTop: '1rem' }}
                    onClick={() => claimDelivery(delivery.id)}
                    disabled={processingCode === delivery.id}
                  >
                    {processingCode === delivery.id ? 'Claiming...' : 'Accept Delivery Task'}
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'queue' && (
          <div className={styles.deliveryList}>
            {deliveries.length === 0 ? (
              <div className={styles.emptyState}>
                <Clock size={48} />
                <h3>Batch is Empty</h3>
                <p>Accept tasks from the 'Available' tab to start earning.</p>
              </div>
            ) : (
              deliveries.map((delivery) => (
                <div key={delivery.id} className={styles.deliveryItem}>
                  <div className={styles.deliveryHeader}>
                    <div>
                      <span className={styles.orderId}>#ORD-{delivery.order_id.slice(0, 8)}</span>
                      <div className={styles.tags}>
                        <span className={`${styles.badge} ${styles.pickup}`}>Pickup: {delivery.orders?.brands?.location_name || 'Vendor'}</span>
                        <span className={`${styles.badge} ${styles.dropoff}`}>{delivery.status}</span>
                      </div>
                    </div>
                    <div className={styles.price}>₦500 Earning</div>
                  </div>

                  <div className={styles.grid}>
                    <div className={styles.infoBlock}>
                      <h5><MapPin size={14} /> Pickup From</h5>
                      <p><strong>{delivery.orders?.brands?.name}</strong></p>
                      <p style={{ fontSize: '0.85rem' }}>{delivery.orders?.brands?.location_name || 'ABUAD Campus'}</p>
                      <Link href={`https://wa.me/${delivery.orders?.brands?.whatsapp_number}`} className={styles.contactLink} target="_blank">
                        <Phone size={12} /> Contact Vendor
                      </Link>
                    </div>

                    <div className={styles.infoBlock}>
                      <h5><Navigation size={14} /> Dropoff To</h5>
                      <p><strong>{delivery.orders?.users?.name}</strong></p>
                      <p style={{ fontSize: '0.85rem' }}>{delivery.orders?.shipping_address}</p>
                      <Link href={`tel:${delivery.orders?.users?.phone}`} className={styles.contactLink}>
                        <Phone size={12} /> Call Customer
                      </Link>
                    </div>
                  </div>

                  <div className={styles.actionArea}>
                    {delivery.status === 'assigned' && (
                      <button className="btn btn-primary w-full" onClick={() => updateStatus(delivery.id, 'picked_up')}>
                        <Package size={18} /> Confirm Pickup
                      </button>
                    )}

                    {delivery.status === 'picked_up' && (
                      <div className={styles.verifyGroup}>
                        <input 
                          type="text" 
                          placeholder="Enter Delivery Code"
                          className={styles.codeInput}
                          value={verificationCode}
                          onChange={(e) => setVerificationCode(e.target.value)}
                        />
                        <button 
                          className="btn btn-success"
                          onClick={() => verifyDelivery(delivery.id)}
                          disabled={processingCode === delivery.id}
                        >
                          {processingCode === delivery.id ? 'Verifying...' : 'Complete Delivery'}
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: '1rem' }}>
                     <Link href={`/delivery/invoice/${delivery.id}`} className={styles.invoiceBtn}>
                        <FileText size={14} /> View Digital Invoice
                     </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className={styles.emptyState}>
            <Clock size={48} />
            <h3>History Coming Soon</h3>
          </div>
        )}
      </main>
    </div>
  );
}

function Loader2({ size, className }: any) {
  return <RefreshCw size={size} className={className} />;
}

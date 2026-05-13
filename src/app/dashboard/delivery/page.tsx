/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Zap, 
  MapPin, 
  Package, 
  Clock, 
  Wallet, 
  Truck, 
  LogOut, 
  Navigation,
  FileText,
  Phone,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/lib/utils';
import styles from './delivery.module.css';

interface Wallet {
  id: string;
  agent_id: string;
  balance: number;
  bank_name?: string;
  account_number?: string;
  account_name?: string;
  available_balance?: number; // legacy support
  pending_balance?: number;
  total_withdrawn?: number;
}

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
  const [payoutAmount, setPayoutAmount] = useState(500);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [payoutRequests, setPayoutRequests] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [bankForm, setBankForm] = useState({ bankName: '', accountNumber: '', accountName: '' });
  const [isSettingUpBank, setIsSettingUpBank] = useState(false);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    if (silent) setRefreshing(true);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Fetch Settings
    const { data: settings } = await supabase.from('platform_settings').select('value').eq('key', 'delivery_agent_payout').single();
    if (settings?.value) {
      setPayoutAmount(Number(settings.value) || 500);
    }

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
          delivery_code,
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

    // Fetch Wallet
    const { data: walletData } = await supabase.from('agent_wallets').select('*').eq('agent_id', session.user.id).single();
    setWallet(walletData);

    // Fetch History
    const { data: histData } = await supabase
      .from('deliveries')
      .select('*, orders(id, total_amount, shipping_address, brands(name))')
      .eq('agent_id', session.user.id)
      .eq('status', 'delivered')
      .order('created_at', { ascending: false });
    setHistory(histData || []);

    // Fetch Payouts
    const { data: payoutData } = await supabase.from('payout_requests').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });
    setPayoutRequests(payoutData || []);

    if (!silent) setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/login?redirect=/dashboard/delivery');
        return;
      }

      const { data: userData } = await supabase.from('users').select('role, name, phone').eq('id', session.user.id).single();
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
        setAgent({ ...newAgent, name: userData.name, phone: userData.phone });
      } else {
        setAgent({ ...agentData, name: userData.name, phone: userData.phone });
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
    let interval: ReturnType<typeof setInterval> | undefined;
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
          }, (err) => console.error(err));
        }
      };
      updateLocation();
      interval = setInterval(updateLocation, 30000); 
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
      .update({ 
        agent_id: agent.id, 
        status: 'assigned',
        agent_name: agent.name,
        agent_phone: agent.phone
      })
      .eq('id', deliveryId)
      .is('agent_id', null); 

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

    try {
      const res = await fetch('/api/delivery/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryId, code: verificationCode, agentId: agent.id })
      });
      const data = await res.json();
      
      if (data.success) {
        setDeliveries(deliveries.filter(d => d.id !== deliveryId));
        setVerificationCode('');
        alert(`Delivery successful! ${formatPrice(payoutAmount)} has been added to your wallet.`);
        fetchData(true);
      } else {
        alert(data.error || 'Failed to verify delivery.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error verifying delivery');
    } finally {
      setProcessingCode(null);
    }
  };

  const updateStatus = async (deliveryId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/delivery/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryId, status: newStatus, agentId: agent.id })
      });
      const data = await res.json();
      if (data.success) {
        setDeliveries(deliveries.map(d => d.id === deliveryId ? { ...d, status: newStatus } : d));
      } else {
        alert(data.error || 'Failed to update status');
      }
    } catch (err) {
      console.error(err);
      alert('Network error updating status');
    }
  };

  const handleWithdrawalRequest = async (amount: number) => {
    if (!wallet || amount > (wallet.available_balance || wallet.balance)) {
      alert('Insufficient available balance');
      return;
    }
    if (!agent.bank_name || !agent.bank_account_number) {
      alert('Please set up your bank details in settings first');
      setIsSettingUpBank(true);
      return;
    }

    try {
      const { error } = await supabase.rpc('request_payout', {
        p_user_id: agent.id,
        p_role: 'delivery',
        p_amount: amount,
        p_bank_details: {
          bankName: agent.bank_name,
          accountNumber: agent.bank_account_number,
          accountName: agent.account_name || agent.name
        }
      });

      if (!error) {
        alert('Withdrawal request submitted!');
        setIsWithdrawing(false);
        fetchData(true);
      } else {
        alert(error.message);
      }
    } catch (err) {
      console.error(err);
      alert('Error requesting payout');
    }
  };

  const saveBankDetails = async () => {
    const { error } = await supabase.from('delivery_agents').update({
      bank_name: bankForm.bankName,
      bank_account_number: bankForm.accountNumber,
      account_name: bankForm.accountName
    }).eq('id', agent.id);

    if (!error) {
      setAgent({ ...agent, ...bankForm });
      setIsSettingUpBank(false);
      alert('Bank details updated!');
    } else {
      alert(error.message);
    }
  };

  if (loading) return <div className={styles.spinnerWrap}><RefreshCw className="anim-spin" size={48} /></div>;

  return (
    <div className={`container ${styles.page}`}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.agentCard}>
          <div className={styles.avatar}>{agent?.name?.[0] || 'A'}</div>
          <h3 className={styles.agentName}>{agent?.name}</h3>
          <p className={styles.agentBadge}>Delivery Partner</p>
          
          <button 
            className={`${styles.statusToggle} ${agent?.is_active ? styles.statusOnline : styles.statusOffline}`}
            onClick={toggleActive}
          >
            <Zap size={18} fill={agent?.is_active ? "currentColor" : "none"} />
            {agent?.is_active ? 'ONLINE - RECEIVING ORDERS' : 'OFFLINE - ON BREAK'}
          </button>
        </div>

        <div className={styles.card}>
          <h4 className={styles.cardTitle}>Settings</h4>
          <div style={{ marginTop: '1rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-400)' }}>Batch Capacity (10-50)</label>
            <input 
              type="number" 
              className={styles.capacityInput} 
              value={agent?.batch_capacity || 10} 
              onChange={(e) => updateCapacity(parseInt(e.target.value))}
              min="10"
              max="50"
            />
          </div>

          {agent?.agent_type === 'out-campus' && (
            <div style={{ marginTop: '1rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-400)' }}>Base Delivery Fee (₦)</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="number" 
                  className={styles.capacityInput} 
                  value={agent?.base_delivery_fee || 0} 
                  onChange={(e) => setAgent({ ...agent, base_delivery_fee: Number(e.target.value) })}
                  placeholder="e.g. 1500"
                />
                <button 
                  className="btn btn-primary btn-sm"
                  onClick={async () => {
                    const { error } = await supabase.from('delivery_agents').update({ base_delivery_fee: agent.base_delivery_fee }).eq('id', agent.id);
                    if (!error) alert('Delivery fee updated!');
                  }}
                >
                  Save
                </button>
              </div>
              <p style={{ fontSize: '0.65rem', color: 'var(--text-400)', marginTop: '0.25rem' }}>
                This is your base charge. The platform may add a markup to this.
              </p>
            </div>
          )}
        </div>

        <div className={styles.card} style={{ borderLeft: '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Wallet size={20} color="var(--primary)" />
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-400)' }}>Wallet Balance</span>
              <h3 style={{ fontSize: '1.5rem' }}>{formatPrice(wallet?.available_balance || wallet?.balance || 0)}</h3>
              {(wallet?.pending_balance || 0) > 0 && (
                <p style={{ fontSize: '0.7rem', color: 'var(--text-400)' }}>Pending: {formatPrice(wallet?.pending_balance || 0)}</p>
              )}
            </div>
          </div>
          <button 
            className="btn btn-primary btn-sm w-full mt-3" 
            disabled={!wallet || (wallet.available_balance || wallet.balance) < 1000}
            onClick={() => setIsWithdrawing(true)}
          >
            Request Payout
          </button>
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
                         <span className={styles.badge} style={{ background: 'rgba(34, 197, 94, 0.1)', color: 'var(--success)' }}>PLATFORM DELIVERY</span>
                      </div>
                    </div>
                    <div className={styles.price}>{formatPrice(payoutAmount)} Earning</div>
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
                <p>Accept tasks from the &apos;Available&apos; tab to start earning.</p>
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
                    <div className={styles.price}>{formatPrice(payoutAmount)} Earning</div>
                  </div>

                  <div className={styles.grid}>
                    <div className={styles.infoBlock}>
                      <h5><MapPin size={14} /> Pickup From</h5>
                      <p><strong>{delivery.orders?.brands?.name}</strong></p>
                      <p style={{ fontSize: '0.85rem' }}>{delivery.orders?.brands?.location_name || 'Campus'}</p>
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
          <div className={styles.deliveryList}>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
               <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Earnings History</h2>
            </div>
            
            <div className={styles.statsRow}>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Available Balance</span>
                <div className={styles.statValue}>₦{(wallet?.available_balance || wallet?.balance || 0).toLocaleString()}</div>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Pending Balance</span>
                <div className={styles.statValue}>₦{(wallet?.pending_balance || 0).toLocaleString()}</div>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Total Earned</span>
                <div className={styles.statValue}>₦{((wallet?.available_balance || wallet?.balance || 0) + (wallet?.pending_balance || 0)).toLocaleString()}</div>
              </div>
            </div>

            {history.length === 0 && payoutRequests.length === 0 ? (
              <div className={styles.emptyState}>
                <Clock size={48} />
                <h3>No History Yet</h3>
                <p>Complete your first delivery to see earnings history.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {payoutRequests.map(req => (
                  <div key={req.id} className={styles.historyItem} style={{ borderLeft: '3px solid #f59e0b' }}>
                    <div className={styles.historyMain}>
                       <div>
                          <div style={{ fontWeight: 600 }}>Withdrawal Request</div>
                          <div className={styles.subText}>{new Date(req.created_at).toLocaleDateString()}</div>
                       </div>
                       <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, color: '#f59e0b' }}>-{formatPrice(req.amount_requested)}</div>
                          <span className={`${styles.badge} ${styles[req.status as keyof typeof styles] || ''}`}>{req.status.toUpperCase()}</span>
                       </div>
                    </div>
                  </div>
                ))}
                
                {history.map(item => (
                  <div key={item.id} className={styles.historyItem}>
                    <div className={styles.historyMain}>
                       <div>
                          <div style={{ fontWeight: 600 }}>Delivery Completed</div>
                          <div className={styles.subText}>{item.orders?.brands?.name} → {item.orders?.id.slice(0,8)}</div>
                       </div>
                       <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, color: 'var(--success)' }}>+{formatPrice(payoutAmount)}</div>
                          <div className={styles.subText}>{new Date(item.delivered_at || item.created_at).toLocaleDateString()}</div>
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Withdraw Modal */}
      {isWithdrawing && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>Request Withdrawal</h3>
            <p className={styles.subText}>Funds will be sent to your registered bank account within 24 hours.</p>
            
            <div style={{ marginTop: '1.5rem' }}>
              <label>Amount (Min: {formatPrice(1000)})</label>
              <input 
                type="number" 
                className={styles.modalInput} 
                defaultValue={wallet?.available_balance || wallet?.balance || 0}
                id="withdraw-amount"
              />
            </div>
            
            <div className={styles.modalActions}>
              <button className="btn btn-ghost" onClick={() => setIsWithdrawing(false)}>Cancel</button>
              <button 
                className="btn btn-primary"
                onClick={() => {
                  const amount = Number((document.getElementById('withdraw-amount') as HTMLInputElement).value);
                  handleWithdrawalRequest(amount);
                }}
              >
                Confirm Withdrawal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bank Setup Modal */}
      {isSettingUpBank && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>Bank Account Details</h3>
            <p className={styles.subText}>Where should we send your earnings?</p>
            
            <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label>Bank Name</label>
                <input 
                  type="text" 
                  className={styles.modalInput} 
                  placeholder="e.g. Access Bank"
                  value={bankForm.bankName}
                  onChange={e => setBankForm({ ...bankForm, bankName: e.target.value })}
                />
              </div>
              <div>
                <label>Account Number</label>
                <input 
                  type="text" 
                  className={styles.modalInput} 
                  placeholder="10 digits"
                  value={bankForm.accountNumber}
                  onChange={e => setBankForm({ ...bankForm, accountNumber: e.target.value })}
                />
              </div>
              <div>
                <label>Account Name</label>
                <input 
                  type="text" 
                  className={styles.modalInput} 
                  placeholder="Your full legal name"
                  value={bankForm.accountName}
                  onChange={e => setBankForm({ ...bankForm, accountName: e.target.value })}
                />
              </div>
            </div>
            
            <div className={styles.modalActions}>
              <button className="btn btn-ghost" onClick={() => setIsSettingUpBank(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveBankDetails}>Save & Continue</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

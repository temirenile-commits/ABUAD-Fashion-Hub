/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  RefreshCw,
  CheckCircle,
  Bell,
  Layers,
  Star,
  Calendar,
  Tag,
  Info,
  ChevronDown,
  ChevronUp,
  Share2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/lib/utils';
import styles from './delivery.module.css';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AgentWallet {
  id: string;
  agent_id: string;
  balance: number;
  bank_name?: string;
  account_number?: string;
  account_name?: string;
  available_balance?: number;
  pending_balance?: number;
  total_withdrawn?: number;
}

interface DeliveryRecord {
  id: string;
  order_id: string;
  status: string;
  delivery_fee: number;
  agent_id?: string;
  picked_up_at?: string;
  orders?: {
    id: string;
    status: string;
    total_amount: number;
    shipping_address: string;
    customer_id: string;
    delivery_code: string;
    university_id?: string;
    is_preorder?: boolean;
    product_id?: string;
    variants_selected?: any;
    users?: { name: string; phone: string };
    brands?: {
      name: string;
      latitude?: number;
      longitude?: number;
      location_name?: string;
      whatsapp_number?: string;
    };
    products?: { title: string; product_section?: string; location_availability?: string };
  };
}

interface LocationGroup {
  key: string;             // normalised key used for grouping
  label: string;          // best display name found in group
  vendorName: string;
  deliveries: DeliveryRecord[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extracts the most specific pickup location from variants selection, product setup,
 * or vendor configuration.
 */
function getPickupLocation(delivery: DeliveryRecord): string {
  // 1. Check variants_selected for a location-like key (e.g. "Location", "Pickup Point")
  const variants = delivery.orders?.variants_selected;
  if (variants && typeof variants === 'object') {
    for (const [key, value] of Object.entries(variants)) {
      const k = key.toLowerCase();
      if (k.includes('location') || k.includes('pickup') || k.includes('point') || k.includes('place') || k.includes('where') || k.includes('station') || k.includes('spot')) {
        if (value && typeof value === 'string' && value.trim()) {
          return value.trim();
        }
      }
    }
  }

  // 2. Check product availability location
  if (delivery.orders?.products?.location_availability && delivery.orders.products.location_availability.trim()) {
    return delivery.orders.products.location_availability.trim();
  }

  // 3. Fallback to brand's base location
  if (delivery.orders?.brands?.location_name && delivery.orders.brands.location_name.trim()) {
    return delivery.orders.brands.location_name.trim();
  }

  return 'General Campus';
}

/**
 * Normalises a location string down to a short fingerprint so that
 * "Block A, 1st floor" and "Block A 1st Floor, ABUAD" group together.
 * Strategy: lowercase → strip punctuation → take first 3 significant words.
 */
function normaliseLocation(raw: string | undefined | null): string {
  if (!raw) return 'unknown';
  const words = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  // Drop very generic stop-words
  const stop = new Set(['the', 'a', 'an', 'of', 'at', 'on', 'in', 'and', 'for', 'near']);
  const significant = words.filter((w) => !stop.has(w));
  // Fingerprint = first 3 significant words joined
  return significant.slice(0, 3).join(' ');
}

/** Group available deliveries by fuzzy pickup location */
function groupByLocation(deliveries: DeliveryRecord[]): LocationGroup[] {
  const map = new Map<string, LocationGroup>();

  for (const d of deliveries) {
    const rawLoc = getPickupLocation(d);
    const key = normaliseLocation(rawLoc);
    const label = rawLoc;
    const vendorName = d.orders?.brands?.name ?? 'Vendor';

    if (!map.has(key)) {
      map.set(key, { key, label, vendorName, deliveries: [] });
    }
    map.get(key)!.deliveries.push(d);
  }

  // Sort: most deliveries first (best batch opportunity)
  return Array.from(map.values()).sort((a, b) => b.deliveries.length - a.deliveries.length);
}


// ─── Component ───────────────────────────────────────────────────────────────

export default function DeliveryDashboard() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [agent, setAgent] = useState<any>(null);
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [availableDeliveries, setAvailableDeliveries] = useState<DeliveryRecord[]>([]);
  const [knownLocations, setKnownLocations] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'available' | 'queue' | 'history' | 'locations'>('available');
  const [verificationCode, setVerificationCode] = useState('');
  const [verifyTarget, setVerifyTarget] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [wallet, setWallet] = useState<AgentWallet | null>(null);
  const [payoutRequests, setPayoutRequests] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [bankForm, setBankForm] = useState({ bankName: '', accountNumber: '', accountName: '' });
  const [isSettingUpBank, setIsSettingUpBank] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [newOrderAlert, setNewOrderAlert] = useState(false);

  // Keep a ref to the latest agent so the realtime callback sees fresh data
  const agentRef = useRef<any>(null);
  agentRef.current = agent;

  // ─── Data Fetching ──────────────────────────────────────────────────────

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const agentUserId = session.user.id;

    // Agent user record (for university_id)
    const { data: agentUser } = await supabase
      .from('users')
      .select('university_id')
      .eq('id', agentUserId)
      .single();

    const universityId = agentUser?.university_id;

    // ── 1. My active deliveries ──────────────────────────────────────────
    const { data: myData } = await supabase
      .from('deliveries')
      .select(`
        *,
        orders (
          id,
          status,
          total_amount,
          shipping_address,
          customer_id,
          delivery_code,
          university_id,
          is_preorder,
          product_id,
          variants_selected,
          users:customer_id (name, phone),
          brands (name, latitude, longitude, location_name, whatsapp_number),
          products:product_id (title, product_section, location_availability)
        )
      `)
      .eq('agent_id', agentUserId)
      .neq('status', 'delivered')
      .order('created_at', { ascending: false });

    // ── 2. Available queue — orders ready or ready_for_pickup ─────────────
    let availQuery = supabase
      .from('deliveries')
      .select(`
        *,
        orders!inner (
          id,
          status,
          university_id,
          total_amount,
          shipping_address,
          is_preorder,
          product_id,
          variants_selected,
          brands (name, latitude, longitude, location_name, whatsapp_number),
          products:product_id (title, product_section, location_availability)
        )
      `)
      .in('orders.status', ['ready', 'ready_for_pickup']); // Either button marks it ready!

    // Show unassigned orders OR orders already pre-assigned to this agent (for vendor-delivery agents)
    availQuery = availQuery.or(`agent_id.is.null,agent_id.eq.${agentUserId}`);

    if (universityId) {
      availQuery = availQuery.eq('orders.university_id', universityId);
    }

    const { data: availData, error: availError } = await availQuery.order('created_at', { ascending: false });
    if (availError) console.error('[DELIVERY DASH] Available queue error:', availError);
    console.log(`[DELIVERY DASH] Available orders returned: ${availData?.length ?? 0}`);

    // ── 3. All known pickup locations for this university ────────────────
    let brandLocQuery = supabase
      .from('brands')
      .select('location_name')
      .not('location_name', 'is', null);

    let prodLocQuery = supabase
      .from('products')
      .select('location_availability')
      .not('location_availability', 'is', null);

    let orderVarQuery = supabase
      .from('orders')
      .select('variants_selected')
      .not('variants_selected', 'is', null);

    if (universityId) {
      brandLocQuery = brandLocQuery.eq('university_id', universityId);
      prodLocQuery = prodLocQuery.eq('university_id', universityId);
      orderVarQuery = orderVarQuery.eq('university_id', universityId);
    }

    const [brandLocRes, prodLocRes, orderVarRes] = await Promise.all([
      brandLocQuery,
      prodLocQuery,
      orderVarQuery,
    ]);

    const uniqueLocsSet = new Set<string>();

    brandLocRes.data?.forEach((b: any) => {
      if (b.location_name?.trim()) uniqueLocsSet.add(b.location_name.trim());
    });

    prodLocRes.data?.forEach((p: any) => {
      if (p.location_availability?.trim()) uniqueLocsSet.add(p.location_availability.trim());
    });

    orderVarRes.data?.forEach((o: any) => {
      const vars = o.variants_selected;
      if (vars && typeof vars === 'object') {
        for (const [key, value] of Object.entries(vars)) {
          const k = key.toLowerCase();
          if (k.includes('location') || k.includes('pickup') || k.includes('point') || k.includes('place') || k.includes('where')) {
            if (value && typeof value === 'string' && value.trim()) {
              uniqueLocsSet.add(value.trim());
            }
          }
        }
      }
    });

    const uniqueLocs = Array.from(uniqueLocsSet).sort();


    // ── 4. Wallet ────────────────────────────────────────────────────────
    const { data: walletData } = await supabase
      .from('agent_wallets')
      .select('*')
      .eq('agent_id', agentUserId)
      .single();

    // ── 5. History (delivered) ───────────────────────────────────────────
    const { data: histData } = await supabase
      .from('deliveries')
      .select('*, orders(id, total_amount, shipping_address, brands(name))')
      .eq('agent_id', agentUserId)
      .eq('status', 'delivered')
      .order('created_at', { ascending: false })
      .limit(50);

    // ── 6. Payout requests ───────────────────────────────────────────────
    const { data: payoutData } = await supabase
      .from('payout_requests')
      .select('*')
      .eq('user_id', agentUserId)
      .order('created_at', { ascending: false });

    setDeliveries(myData ?? []);
    setAvailableDeliveries(availData ?? []);
    setKnownLocations(uniqueLocs);
    setWallet(walletData);
    setHistory(histData ?? []);
    setPayoutRequests(payoutData ?? []);

    if (!silent) setLoading(false);
    setRefreshing(false);
  }, []);

  // ─── Init + Auth ────────────────────────────────────────────────────────

  useEffect(() => {
    let fallbackInterval: ReturnType<typeof setInterval>;

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/login?redirect=/dashboard/delivery');
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('role, name, phone')
        .eq('id', session.user.id)
        .single();

      if (userData?.role !== 'delivery' && userData?.role !== 'admin') {
        router.push('/dashboard/customer');
        return;
      }

      const { data: agentData } = await supabase
        .from('delivery_agents')
        .select('*')
        .eq('id', session.user.id)
        .single();

      const resolvedAgent = agentData
        ? { ...agentData, name: userData.name, phone: userData.phone }
        : await (async () => {
            const { data: newAgent } = await supabase
              .from('delivery_agents')
              .insert({ id: session.user.id })
              .select()
              .single();
            return { ...newAgent, name: userData.name, phone: userData.phone };
          })();

      setAgent(resolvedAgent);
      await fetchData();

      // ── Realtime: listen to BOTH deliveries AND orders tables ─────────
      // This ensures we catch both:
      //   a) new delivery records being created/updated
      //   b) vendor marking an order ready_for_pickup (orders table update)
      const channel = supabase
        .channel('delivery-pipeline')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'deliveries' },
          () => {
            fetchData(true);
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'orders', filter: 'status=eq.ready_for_pickup' },
          () => {
            setNewOrderAlert(true);
            fetchData(true);
          }
        )
        .subscribe();

      // ── Fallback polling every 60s if WebSocket drops ─────────────────
      fallbackInterval = setInterval(() => fetchData(true), 60_000);

      return () => {
        channel.unsubscribe();
        clearInterval(fallbackInterval);
      };
    }

    init();

    return () => {
      clearInterval(fallbackInterval);
    };
  }, [router, fetchData]);

  // ─── GPS Tracking ────────────────────────────────────────────────────────

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (agent?.id && agent?.is_active) {
      const updateLocation = () => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(async (pos) => {
            const { latitude, longitude } = pos.coords;
            await supabase.from('delivery_agents').update({
              current_lat: latitude,
              current_long: longitude,
              last_active_at: new Date().toISOString(),
            }).eq('id', agent.id);

            const activeIds = deliveries
              .filter((d) => ['picked_up', 'in_transit', 'assigned'].includes(d.status))
              .map((d) => d.id);

            if (activeIds.length > 0) {
              await supabase.from('deliveries').update({
                live_location_lat: latitude,
                live_location_lng: longitude,
                last_updated_at: new Date().toISOString(),
              }).in('id', activeIds);
            }
          });
        }
      };
      updateLocation();
      interval = setInterval(updateLocation, 30_000);
    }
    return () => clearInterval(interval);
  }, [agent?.id, agent?.is_active, deliveries]);

  // ─── Actions ─────────────────────────────────────────────────────────────

  const toggleActive = async () => {
    const newStatus = !agent.is_active;
    const { error } = await supabase
      .from('delivery_agents')
      .update({ is_active: newStatus, last_active_at: new Date().toISOString() })
      .eq('id', agent.id);
    if (!error) setAgent({ ...agent, is_active: newStatus });
  };

  /**
   * Claim a single delivery — atomic: only succeeds if agent_id is still null.
   */
  const claimDelivery = async (deliveryId: string) => {
    if (!agent?.is_active) {
      alert('You must be ONLINE to accept orders.');
      return;
    }
    setProcessingId(deliveryId);
    const { error } = await supabase
      .from('deliveries')
      .update({
        agent_id: agent.id,
        status: 'assigned',
        agent_name: agent.name,
        agent_phone: agent.phone,
      })
      .eq('id', deliveryId)
      .is('agent_id', null);   // ← atomic lock — prevents double-claiming

    if (!error) {
      // Notify customer
      const delivery = availableDeliveries.find((d) => d.id === deliveryId);
      if (delivery?.orders?.customer_id) {
        await supabase.from('notifications').insert({
          user_id: delivery.orders.customer_id,
          title: '🛵 Delivery Agent Assigned!',
          content: `A delivery agent (${agent.name}) has accepted your order and will arrive at the vendor shortly.`,
          is_read: false,
          link: `/track/${delivery.order_id}`,
        });
      }
      await fetchData(true);
      setActiveTab('queue');
    } else {
      alert('This order was already claimed by another agent. The queue has been refreshed.');
      await fetchData(true);
    }
    setProcessingId(null);
  };

  /**
   * Claim an entire batch from one pickup location at once.
   */
  const claimBatch = async (group: LocationGroup) => {
    if (!agent?.is_active) {
      alert('You must be ONLINE to accept orders.');
      return;
    }
    const capacity = agent?.batch_capacity ?? 10;
    const toClaimIds = group.deliveries.slice(0, capacity).map((d) => d.id);

    setProcessingId(`batch-${group.key}`);
    let claimed = 0;
    for (const id of toClaimIds) {
      const { error } = await supabase
        .from('deliveries')
        .update({
          agent_id: agent.id,
          status: 'assigned',
          agent_name: agent.name,
          agent_phone: agent.phone,
        })
        .eq('id', id)
        .is('agent_id', null);
      if (!error) claimed++;
    }

    alert(
      claimed > 0
        ? `✅ Claimed ${claimed} order(s) from ${group.label}!`
        : 'Orders were already claimed by another agent.'
    );
    await fetchData(true);
    setActiveTab('queue');
    setProcessingId(null);
  };

  const updateStatus = async (deliveryId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/delivery/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryId, status: newStatus, agentId: agent.id }),
      });
      const data = await res.json();
      if (data.success) {
        setDeliveries((prev) =>
          prev.map((d) => (d.id === deliveryId ? { ...d, status: newStatus } : d))
        );
      } else {
        alert(data.error || 'Failed to update status');
      }
    } catch {
      alert('Network error updating status');
    }
  };

  const transferToPublic = async (deliveryId: string) => {
    const confirmTransfer = window.confirm(
      "Are you sure you want to transfer this order back to the public console? Other agents will be notified and can accept it."
    );
    if (!confirmTransfer) return;

    setProcessingId(deliveryId);
    try {
      const res = await fetch('/api/delivery/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryId, status: 'transfer', agentId: agent.id }),
      });
      const data = await res.json();
      if (data.success) {
        setDeliveries((prev) => prev.filter((d) => d.id !== deliveryId));
        alert('Order successfully transferred to the public console!');
        await fetchData(true);
      } else {
        alert(data.error || 'Failed to transfer order');
      }
    } catch {
      alert('Network error transferring order');
    } finally {
      setProcessingId(null);
    }
  };


  const verifyDelivery = async (deliveryId: string) => {
    if (!verificationCode) return;
    setProcessingId(deliveryId);
    try {
      const res = await fetch('/api/delivery/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryId, code: verificationCode, agentId: agent.id }),
      });
      const data = await res.json();
      if (data.success) {
        const completed = deliveries.find((d) => d.id === deliveryId);
        setDeliveries((prev) => prev.filter((d) => d.id !== deliveryId));
        setVerificationCode('');
        setVerifyTarget(null);
        alert(`Delivery confirmed! ${formatPrice(completed?.delivery_fee ?? 500)} added to your wallet.`);
        fetchData(true);
      } else {
        alert(data.error || 'Failed to verify delivery.');
      }
    } catch {
      alert('Network error verifying delivery');
    } finally {
      setProcessingId(null);
    }
  };

  const handleWithdrawal = async () => {
    const el = document.getElementById('withdraw-amount') as HTMLInputElement;
    const amount = Number(el?.value ?? 0);
    if (!wallet || amount < 1000 || amount > (wallet.available_balance ?? wallet.balance ?? 0)) {
      alert('Invalid amount or insufficient balance (min ₦1,000).');
      return;
    }
    if (!agent.bank_name || !agent.bank_account_number) {
      alert('Please set up your bank details first.');
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
          accountName: agent.account_name ?? agent.name,
        },
      });
      if (!error) {
        alert('Withdrawal request submitted!');
        setIsWithdrawing(false);
        fetchData(true);
      } else {
        alert(error.message);
      }
    } catch {
      alert('Error requesting payout');
    }
  };

  const saveBankDetails = async () => {
    const { error } = await supabase
      .from('delivery_agents')
      .update({
        bank_name: bankForm.bankName,
        bank_account_number: bankForm.accountNumber,
        account_name: bankForm.accountName,
      })
      .eq('id', agent.id);
    if (!error) {
      setAgent({ ...agent, ...bankForm });
      setIsSettingUpBank(false);
      alert('Bank details saved!');
    } else {
      alert(error.message);
    }
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // ─── Derived ─────────────────────────────────────────────────────────────

  const locationGroups = groupByLocation(availableDeliveries);
  const totalEarned = (wallet?.available_balance ?? wallet?.balance ?? 0) + (wallet?.pending_balance ?? 0);

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={styles.spinnerWrap}>
        <RefreshCw className="anim-spin" size={48} />
      </div>
    );
  }

  return (
    <div className={`container ${styles.page}`}>
      {/* ── Sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.agentCard}>
          <div className={styles.avatar}>{agent?.name?.[0] ?? 'A'}</div>
          <h3 className={styles.agentName}>{agent?.name}</h3>
          <p className={styles.agentBadge}>Delivery Partner</p>

          <button
            className={`${styles.statusToggle} ${agent?.is_active ? styles.statusOnline : styles.statusOffline}`}
            onClick={toggleActive}
          >
            <Zap size={18} fill={agent?.is_active ? 'currentColor' : 'none'} />
            {agent?.is_active ? 'ONLINE — RECEIVING ORDERS' : 'OFFLINE — ON BREAK'}
          </button>
        </div>

        {/* Quick stats */}
        <div className={styles.card} style={{ borderLeft: '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Wallet size={20} color="var(--primary)" />
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-400)' }}>Available Balance</span>
              <h3 style={{ fontSize: '1.5rem' }}>
                {formatPrice(wallet?.available_balance ?? wallet?.balance ?? 0)}
              </h3>
              {(wallet?.pending_balance ?? 0) > 0 && (
                <p style={{ fontSize: '0.7rem', color: 'var(--text-400)' }}>
                  Pending: {formatPrice(wallet?.pending_balance ?? 0)}
                </p>
              )}
            </div>
          </div>
          <button
            className="btn btn-primary btn-sm w-full mt-3"
            disabled={!wallet || (wallet.available_balance ?? wallet.balance ?? 0) < 1000}
            onClick={() => setIsWithdrawing(true)}
          >
            Request Payout
          </button>
        </div>

        {/* Settings */}
        <div className={styles.card}>
          <h4 className={styles.cardTitle}>Settings</h4>
          <div style={{ marginTop: '1rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-400)' }}>
              Batch Capacity (1–50)
            </label>
            <input
              type="number"
              className={styles.capacityInput}
              value={agent?.batch_capacity ?? 10}
              onChange={(e) =>
                supabase
                  .from('delivery_agents')
                  .update({ batch_capacity: parseInt(e.target.value) })
                  .eq('id', agent.id)
                  .then(() => setAgent({ ...agent, batch_capacity: parseInt(e.target.value) }))
              }
              min="1"
              max="50"
            />
          </div>

          {agent?.agent_type === 'out-campus' && (
            <div style={{ marginTop: '1rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-400)' }}>
                Base Delivery Fee (₦)
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="number"
                  className={styles.capacityInput}
                  value={agent?.base_delivery_fee ?? 0}
                  onChange={(e) => setAgent({ ...agent, base_delivery_fee: Number(e.target.value) })}
                  placeholder="e.g. 1500"
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={async () => {
                    const { error } = await supabase
                      .from('delivery_agents')
                      .update({ base_delivery_fee: agent.base_delivery_fee })
                      .eq('id', agent.id);
                    if (!error) alert('Fee updated!');
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          )}

          <button
            className="btn btn-ghost btn-sm w-full mt-3"
            onClick={() => setIsSettingUpBank(true)}
          >
            {agent?.bank_name ? '✏️ Edit Bank Details' : '+ Add Bank Details'}
          </button>
        </div>

        <button className="btn btn-ghost w-full" onClick={() => supabase.auth.signOut()}>
          <LogOut size={18} /> Logout
        </button>
      </aside>

      {/* ── Main ── */}
      <main className={styles.main}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Dispatch Console</h1>
            <p className={styles.subtitle}>
              {availableDeliveries.length > 0
                ? `${availableDeliveries.length} order(s) ready for pickup across ${locationGroups.length} location(s)`
                : 'No orders waiting. Stay online!'}
            </p>
          </div>
          <button
            className={styles.refreshBtn}
            onClick={() => { setNewOrderAlert(false); fetchData(true); }}
            disabled={refreshing}
          >
            {newOrderAlert && (
              <span style={{
                position: 'absolute',
                top: -4,
                right: -4,
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: '#ef4444',
              }} />
            )}
            <RefreshCw size={18} className={refreshing ? 'anim-spin' : ''} />
          </button>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'available' ? styles.tabActive : ''}`}
            onClick={() => { setActiveTab('available'); setNewOrderAlert(false); }}
          >
            <Bell size={14} style={{ marginRight: 4 }} />
            Available ({availableDeliveries.length})
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'queue' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('queue')}
          >
            <Layers size={14} style={{ marginRight: 4 }} />
            My Batch ({deliveries.length})
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'locations' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('locations')}
          >
            <MapPin size={14} style={{ marginRight: 4 }} />
            All Locations ({knownLocations.length})
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'history' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <Star size={14} style={{ marginRight: 4 }} />
            History
          </button>
        </div>

        {/* ── AVAILABLE TAB ── */}
        {activeTab === 'available' && (
          <div className={styles.deliveryList}>
            {locationGroups.length === 0 ? (
              <div className={styles.emptyState}>
                <Truck size={48} className="anim-float" />
                <h3>No Orders Ready for Pickup</h3>
                <p>When vendors mark orders as &quot;Ready for Pickup&quot;, they&apos;ll appear here instantly.</p>
                <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>Auto-refreshes every 60 seconds.</p>
              </div>
            ) : (
              locationGroups.map((group) => {
                const isExpanded = expandedGroups.has(group.key);
                const isBatchProcessing = processingId === `batch-${group.key}`;
                return (
                  <div
                    key={group.key}
                    className={styles.deliveryItem}
                    style={{ borderLeft: '4px solid var(--primary)', marginBottom: '1.5rem' }}
                  >
                    {/* Group Header */}
                    <div
                      className={styles.deliveryHeader}
                      style={{ cursor: 'pointer' }}
                      onClick={() => toggleGroup(group.key)}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <MapPin size={16} color="var(--primary)" />
                          <span style={{ fontWeight: 700, fontSize: '1rem' }}>{group.label}</span>
                          <span
                            className={styles.badge}
                            style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}
                          >
                            {group.deliveries.length} order{group.deliveries.length > 1 ? 's' : ''}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-400)', marginTop: '0.25rem' }}>
                          {group.vendorName}
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, color: 'var(--success)' }}>
                            {formatPrice(
                              group.deliveries.reduce((s, d) => s + (d.delivery_fee ?? 500), 0)
                            )}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-400)' }}>
                            total batch earning
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                    </div>

                    {/* Batch claim button */}
                    {group.deliveries.length > 1 && (
                      <button
                        className="btn btn-primary w-full"
                        style={{ marginTop: '0.75rem', marginBottom: isExpanded ? '1rem' : 0 }}
                        onClick={() => claimBatch(group)}
                        disabled={isBatchProcessing || !agent?.is_active}
                      >
                        {isBatchProcessing
                          ? 'Claiming batch...'
                          : `⚡ Claim All ${group.deliveries.length} Orders from This Location`}
                      </button>
                    )}

                    {/* Expanded individual orders */}
                    {isExpanded && group.deliveries.map((delivery) => (
                      <div
                        key={delivery.id}
                        style={{
                          background: 'var(--bg-300)',
                          borderRadius: 'var(--radius-md)',
                          padding: '1rem',
                          marginBottom: '0.75rem',
                        }}
                      >
                        <div className={styles.deliveryHeader}>
                          <div>
                            <span className={styles.orderId}>
                              #{delivery.order_id.slice(0, 8).toUpperCase()}
                            </span>
                            <div className={styles.tags}>
                              {delivery.orders?.is_preorder && (
                                <span
                                  className={styles.badge}
                                  style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}
                                >
                                  <Calendar size={10} style={{ marginRight: 3 }} />
                                  PRE-ORDER
                                </span>
                              )}
                              <span
                                className={styles.badge}
                                style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--success)' }}
                              >
                                READY FOR PICKUP
                              </span>
                              {delivery.orders?.products?.product_section && (
                                <span
                                  className={styles.badge}
                                  style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}
                                >
                                  <Tag size={10} style={{ marginRight: 3 }} />
                                  {delivery.orders.products.product_section.toUpperCase()}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className={styles.price}>
                            {formatPrice(delivery.delivery_fee ?? 500)}
                          </div>
                        </div>

                        <div className={styles.grid}>
                          <div className={styles.infoBlock}>
                            <h5><MapPin size={14} /> Pickup Location</h5>
                            <p><strong>{delivery.orders?.brands?.name}</strong></p>
                            <p style={{ fontSize: '0.85rem' }}>
                              {delivery.orders?.brands?.location_name ?? 'See vendor details'}
                            </p>
                          </div>
                          <div className={styles.infoBlock}>
                            <h5><Navigation size={14} /> Drop-off</h5>
                            <p style={{ fontSize: '0.85rem' }}>
                              {delivery.orders?.shipping_address ?? 'Address not set'}
                            </p>
                          </div>
                        </div>

                        {delivery.orders?.products?.title && (
                          <div
                            style={{
                              marginTop: '0.75rem',
                              padding: '0.5rem 0.75rem',
                              background: 'rgba(99,102,241,0.07)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.85rem',
                            }}
                          >
                            <Info size={12} style={{ marginRight: 6, verticalAlign: 'middle', color: '#818cf8' }} />
                            <strong>Item:</strong> {delivery.orders.products.title}
                          </div>
                        )}

                        <button
                          className="btn btn-primary w-full"
                          style={{ marginTop: '0.75rem' }}
                          onClick={() => claimDelivery(delivery.id)}
                          disabled={processingId === delivery.id || !agent?.is_active}
                        >
                          {processingId === delivery.id ? 'Accepting...' : 'Accept This Order'}
                        </button>
                      </div>
                    ))}

                    {/* Toggle label when collapsed */}
                    {!isExpanded && (
                      <button
                        className="btn btn-ghost btn-sm w-full"
                        style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}
                        onClick={() => toggleGroup(group.key)}
                      >
                        View {group.deliveries.length} order detail{group.deliveries.length > 1 ? 's' : ''}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── MY BATCH TAB ── */}
        {activeTab === 'queue' && (
          <div className={styles.deliveryList}>
            {deliveries.length === 0 ? (
              <div className={styles.emptyState}>
                <Clock size={48} />
                <h3>Your Batch is Empty</h3>
                <p>Accept tasks from the &quot;Available&quot; tab to start earning.</p>
              </div>
            ) : (
              deliveries.map((delivery) => (
                <div key={delivery.id} className={styles.deliveryItem}>
                  <div className={styles.deliveryHeader}>
                    <div>
                      <span className={styles.orderId}>
                        #ORD-{delivery.order_id.slice(0, 8).toUpperCase()}
                      </span>
                      <div className={styles.tags}>
                        {delivery.orders?.is_preorder && (
                          <span
                            className={styles.badge}
                            style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}
                          >
                            PRE-ORDER
                          </span>
                        )}
                        <span className={`${styles.badge} ${styles.dropoff}`}>
                          {delivery.status.replace(/_/g, ' ').toUpperCase()}
                        </span>
                        {delivery.orders?.products?.product_section && (
                          <span
                            className={styles.badge}
                            style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8' }}
                          >
                            {delivery.orders.products.product_section.toUpperCase()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={styles.price}>
                      {formatPrice(delivery.delivery_fee ?? 500)} Earning
                    </div>
                  </div>

                  <div className={styles.grid}>
                    <div className={styles.infoBlock}>
                      <h5><MapPin size={14} /> Pickup From</h5>
                      <p><strong>{delivery.orders?.brands?.name}</strong></p>
                      <p style={{ fontSize: '0.85rem' }}>
                        {delivery.orders?.brands?.location_name ?? 'Campus'}
                      </p>
                      {delivery.orders?.brands?.whatsapp_number && (
                        <Link
                          href={`https://wa.me/${delivery.orders.brands.whatsapp_number}`}
                          className={styles.contactLink}
                          target="_blank"
                        >
                          <Phone size={12} /> Contact Vendor
                        </Link>
                      )}
                    </div>

                    <div className={styles.infoBlock}>
                      <h5><Navigation size={14} /> Drop-off To</h5>
                      <p><strong>{delivery.orders?.users?.name}</strong></p>
                      <p style={{ fontSize: '0.85rem' }}>{delivery.orders?.shipping_address}</p>
                      {delivery.orders?.users?.phone && (
                        <Link
                          href={`tel:${delivery.orders.users.phone}`}
                          className={styles.contactLink}
                        >
                          <Phone size={12} /> Call Customer
                        </Link>
                      )}
                    </div>
                  </div>

                  {delivery.orders?.products?.title && (
                    <div
                      style={{
                        marginTop: '0.75rem',
                        padding: '0.5rem 0.75rem',
                        background: 'rgba(99,102,241,0.07)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.85rem',
                      }}
                    >
                      <Package size={12} style={{ marginRight: 6, verticalAlign: 'middle', color: '#818cf8' }} />
                      <strong>Item:</strong> {delivery.orders.products.title}
                    </div>
                  )}

                  <div className={styles.actionArea}>
                    {delivery.status === 'assigned' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                        <button
                          className="btn btn-primary w-full"
                          onClick={() => updateStatus(delivery.id, 'picked_up')}
                        >
                          <Package size={18} /> Confirm Pickup from Vendor
                        </button>
                        <button
                          className="btn btn-outline w-full"
                          style={{ borderColor: '#ef4444', color: '#ef4444', background: 'transparent' }}
                          onClick={() => transferToPublic(delivery.id)}
                          disabled={processingId === delivery.id}
                        >
                          <Share2 size={16} style={{ marginRight: 6 }} /> Transfer to Public Console
                        </button>
                      </div>
                    )}

                    {delivery.status === 'picked_up' && (
                      verifyTarget === delivery.id ? (
                        <div className={styles.verifyGroup}>
                          <input
                            type="text"
                            placeholder="Enter 6-digit delivery code"
                            className={styles.codeInput}
                            value={verificationCode}
                            onChange={(e) => setVerificationCode(e.target.value)}
                            maxLength={6}
                          />
                          <button
                            className="btn btn-success"
                            onClick={() => verifyDelivery(delivery.id)}
                            disabled={processingId === delivery.id}
                          >
                            {processingId === delivery.id ? 'Verifying...' : 'Complete'}
                          </button>
                          <button
                            className="btn btn-ghost"
                            onClick={() => { setVerifyTarget(null); setVerificationCode(''); }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          className="btn btn-success w-full"
                          onClick={() => setVerifyTarget(delivery.id)}
                        >
                          <CheckCircle size={18} /> Enter Delivery Code
                        </button>
                      )
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

        {/* ── ALL LOCATIONS TAB ── */}
        {activeTab === 'locations' && (
          <div className={styles.deliveryList}>
            <p style={{ color: 'var(--text-400)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
              All vendor pickup locations registered in your university. Orders marked &quot;Ready for
              Pickup&quot; will match one of these locations.
            </p>
            {knownLocations.length === 0 ? (
              <div className={styles.emptyState}>
                <MapPin size={48} />
                <h3>No Locations Recorded</h3>
                <p>As vendors register and set their locations, they will appear here.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                {knownLocations.map((loc, i) => {
                  // Highlight locations that have live orders waiting
                  const hasLiveOrders = locationGroups.some(
                    (g) => normaliseLocation(loc) === g.key
                  );
                  return (
                    <div
                      key={i}
                      style={{
                        background: hasLiveOrders ? 'rgba(34,197,94,0.08)' : 'var(--bg-200)',
                        border: `1px solid ${hasLiveOrders ? 'var(--success)' : 'var(--border)'}`,
                        borderRadius: 'var(--radius-md)',
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <MapPin size={14} color={hasLiveOrders ? 'var(--success)' : 'var(--text-400)'} />
                        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{loc}</span>
                      </div>
                      {hasLiveOrders && (
                        <span
                          className={styles.badge}
                          style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--success)', width: 'fit-content' }}
                        >
                          ORDERS WAITING
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {activeTab === 'history' && (
          <div className={styles.deliveryList}>
            <div className={styles.statsRow}>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Available Balance</span>
                <div className={styles.statValue}>
                  ₦{(wallet?.available_balance ?? wallet?.balance ?? 0).toLocaleString()}
                </div>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Pending Balance</span>
                <div className={styles.statValue}>
                  ₦{(wallet?.pending_balance ?? 0).toLocaleString()}
                </div>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Total Earned</span>
                <div className={styles.statValue}>₦{totalEarned.toLocaleString()}</div>
              </div>
            </div>

            {history.length === 0 && payoutRequests.length === 0 ? (
              <div className={styles.emptyState}>
                <Clock size={48} />
                <h3>No History Yet</h3>
                <p>Complete your first delivery to see earnings here.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
                {payoutRequests.map((req) => (
                  <div
                    key={req.id}
                    className={styles.historyItem}
                    style={{ borderLeft: '3px solid #f59e0b' }}
                  >
                    <div className={styles.historyMain}>
                      <div>
                        <div style={{ fontWeight: 600 }}>Withdrawal Request</div>
                        <div className={styles.subText}>
                          {new Date(req.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, color: '#f59e0b' }}>
                          -{formatPrice(req.amount_requested)}
                        </div>
                        <span className={styles.badge}>{req.status.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {history.map((item) => (
                  <div key={item.id} className={styles.historyItem}>
                    <div className={styles.historyMain}>
                      <div>
                        <div style={{ fontWeight: 600 }}>Delivery Completed</div>
                        <div className={styles.subText}>
                          {item.orders?.brands?.name} → #{item.orders?.id?.slice(0, 8)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 700, color: 'var(--success)' }}>
                          +{formatPrice(item.delivery_fee ?? 500)}
                        </div>
                        <div className={styles.subText}>
                          {new Date(item.delivered_at ?? item.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Withdrawal Modal ── */}
      {isWithdrawing && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>Request Withdrawal</h3>
            <p className={styles.subText}>
              Funds will be transferred to your registered bank account within 24 hours.
            </p>
            <div style={{ marginTop: '1.5rem' }}>
              <label>Amount (Min: ₦1,000)</label>
              <input
                type="number"
                className={styles.modalInput}
                defaultValue={wallet?.available_balance ?? wallet?.balance ?? 0}
                id="withdraw-amount"
                min={1000}
              />
            </div>
            <div className={styles.modalActions}>
              <button className="btn btn-ghost" onClick={() => setIsWithdrawing(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleWithdrawal}>Confirm Withdrawal</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bank Setup Modal ── */}
      {isSettingUpBank && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>Bank Account Details</h3>
            <p className={styles.subText}>Where should we send your earnings?</p>
            <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[
                { label: 'Bank Name', key: 'bankName', placeholder: 'e.g. Access Bank' },
                { label: 'Account Number', key: 'accountNumber', placeholder: '10 digits' },
                { label: 'Account Name', key: 'accountName', placeholder: 'Your full legal name' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label>{label}</label>
                  <input
                    type="text"
                    className={styles.modalInput}
                    placeholder={placeholder}
                    value={bankForm[key as keyof typeof bankForm]}
                    onChange={(e) => setBankForm({ ...bankForm, [key]: e.target.value })}
                  />
                </div>
              ))}
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

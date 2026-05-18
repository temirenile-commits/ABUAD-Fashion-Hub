'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Package, Truck, CheckCircle, Clock, MapPin,
  ChevronLeft, Loader2, AlertTriangle, ShieldCheck,
  UtensilsCrossed, Star, Bell
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/lib/utils';
import styles from './track.module.css';

/* Full ordered list of steps the order can pass through */
const ALL_STEPS = [
  { key: 'pending',          label: 'Order Placed',        desc: 'Your order has been received.' },
  { key: 'paid',             label: 'Payment Secured',      desc: 'Payment confirmed & held in escrow.' },
  { key: 'preorder_paid',    label: 'Pre-Order Secured',    desc: 'Pre-order payment received & secured.' },
  { key: 'accepted',         label: 'Vendor Accepted',      desc: 'The vendor has accepted your order.' },
  { key: 'processing',       label: 'Being Prepared',       desc: 'Your order is being prepared.' },
  { key: 'ready',            label: 'Ready for Pickup',     desc: 'Awaiting a delivery agent.' },
  { key: 'ready_for_pickup', label: 'Ready for Pickup',     desc: 'Awaiting a delivery agent.' },
  { key: 'picked_up',        label: 'Picked Up',            desc: 'Delivery agent has your order.' },
  { key: 'in_transit',       label: 'On the Way',           desc: 'Your order is on its way to you!' },
  { key: 'delivered',        label: 'Delivered',            desc: 'Order has been delivered.' },
  { key: 'confirmed',        label: 'Confirmed',            desc: 'Delivery confirmed. Escrow released.' },
  { key: 'completed',        label: 'Completed',            desc: 'Order complete. Thank you!' },
];

const STATUS_ORDER = ALL_STEPS.map(s => s.key);

function getVisibleSteps(currentStatus: string, isPreorder: boolean) {
  // Build a clean, deduplicated step list based on order type
  let keys: string[];
  if (isPreorder) {
    keys = ['pending', 'preorder_paid', 'accepted', 'processing', 'ready_for_pickup', 'picked_up', 'in_transit', 'delivered', 'completed'];
  } else {
    keys = ['pending', 'paid', 'accepted', 'processing', 'ready', 'picked_up', 'in_transit', 'delivered', 'completed'];
  }
  // If current status is not in the list, inject it
  if (!keys.includes(currentStatus) && STATUS_ORDER.includes(currentStatus)) {
    const idx = STATUS_ORDER.indexOf(currentStatus);
    const insertAfter = keys.filter(k => STATUS_ORDER.indexOf(k) < idx).pop();
    const insertIdx = insertAfter ? keys.indexOf(insertAfter) + 1 : 0;
    keys.splice(insertIdx, 0, currentStatus);
  }
  return keys.map(k => ALL_STEPS.find(s => s.key === k)!).filter(Boolean);
}

function getCurrentStepIndex(steps: typeof ALL_STEPS, currentStatus: string) {
  const idx = steps.findIndex(s => s.key === currentStatus);
  return idx >= 0 ? idx : 0;
}

function getStatusColor(status: string) {
  if (['completed', 'confirmed', 'delivered'].includes(status)) return 'var(--success, #22c55e)';
  if (['in_transit', 'picked_up'].includes(status)) return '#3b82f6';
  if (['ready', 'ready_for_pickup', 'processing', 'accepted'].includes(status)) return '#f59e0b';
  if (['paid', 'preorder_paid'].includes(status)) return 'var(--primary)';
  if (['cancelled', 'failed'].includes(status)) return '#ef4444';
  return 'var(--text-400)';
}

export default function TrackingPage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [delivery, setDelivery] = useState<any>(null);
  const [error, setError] = useState('');
  const [lastStatus, setLastStatus] = useState<string>('');
  const [justUpdated, setJustUpdated] = useState(false);
  const notifSent = useRef<Set<string>>(new Set());

  const fetchOrder = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push(`/auth/login?redirect=/track/${id}`); return; }

    const { data, error: err } = await supabase
      .from('orders')
      .select('*, products(title, media_urls), brands(name, logo_url, whatsapp_number)')
      .eq('id', id)
      .single();

    if (err || !data) { setError('Order not found or access denied.'); setLoading(false); return; }

    setOrder(data);

    const { data: delivData } = await supabase
      .from('deliveries')
      .select('*, users:agent_id(name, phone)')
      .eq('order_id', id)
      .single();
    if (delivData) setDelivery(delivData);
    setLoading(false);
  };

  useEffect(() => { fetchOrder(); }, [id]);

  // ── Real-time subscription ──────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`track-order-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        (payload) => {
          const updated = payload.new as any;
          setOrder((prev: any) => ({ ...prev, ...updated }));

          // Trigger pulse animation
          setJustUpdated(true);
          setTimeout(() => setJustUpdated(false), 3000);

          // Browser notification (if permission granted)
          const newStatus = updated.status;
          if (!notifSent.current.has(newStatus)) {
            notifSent.current.add(newStatus);
            const step = ALL_STEPS.find(s => s.key === newStatus);
            if (step && 'Notification' in window && Notification.permission === 'granted') {
              new Notification(`Order Update: ${step.label}`, {
                body: step.desc,
                icon: '/favicon.ico',
              });
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // ── Request notification permission once ───────────────────────────────────
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  if (loading) return (
    <div className={styles.loading}>
      <Loader2 className="anim-spin" size={32} color="var(--primary)" />
      <p>Tracking your order...</p>
    </div>
  );

  if (error || !order) return (
    <div className={styles.errorPage}>
      <AlertTriangle size={48} color="#ef4444" />
      <h2>Tracking Error</h2>
      <p>{error}</p>
      <Link href="/dashboard/customer" className="btn btn-primary">Back to Dashboard</Link>
    </div>
  );

  const steps = getVisibleSteps(order.status, !!order.is_preorder);
  const activeIdx = getCurrentStepIndex(steps, order.status);
  const isCancelled = ['cancelled', 'failed'].includes(order.status);
  const accentColor = getStatusColor(order.status);

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <Link href="/dashboard/customer" className={styles.backLink}>
          <ChevronLeft size={16} /> My Orders
        </Link>
        <div className={styles.headerMeta}>
          <h1 className={styles.pageTitle}>Live Order Tracking</h1>
          <span className={styles.orderId}>#{order.id.slice(0, 12).toUpperCase()}</span>
        </div>
      </div>

      {/* ── Status Hero Banner ── */}
      <div className={styles.heroBanner} style={{ borderColor: accentColor }}>
        <div className={styles.heroLeft}>
          <div className={styles.heroIcon} style={{ background: `${accentColor}18`, color: accentColor }}>
            {['delivered', 'confirmed', 'completed'].includes(order.status)
              ? <CheckCircle size={28} />
              : ['in_transit', 'picked_up'].includes(order.status)
              ? <Truck size={28} />
              : <Package size={28} />}
          </div>
          <div>
            <p className={styles.heroLabel}>Current Status</p>
            <h2 className={styles.heroStatus} style={{ color: accentColor }}>
              {order.status.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
            </h2>
            <p className={styles.heroDesc}>
              {ALL_STEPS.find(s => s.key === order.status)?.desc || 'Processing your order...'}
            </p>
          </div>
        </div>
        {/* Live pulse indicator */}
        {!isCancelled && (
          <div className={`${styles.livePill} ${justUpdated ? styles.livePillFlash : ''}`}>
            <span className={styles.liveDot} style={{ background: accentColor }} />
            LIVE
          </div>
        )}
      </div>

      <div className={styles.layout}>
        {/* ── LEFT: Stepper + Details ── */}
        <div className={styles.mainCol}>

          {/* Step tracker */}
          <div className={`card ${styles.stepperCard} ${justUpdated ? styles.updatedGlow : ''}`}>
            <h3 className={styles.stepperTitle}>Order Journey</h3>
            <div className={styles.stepper}>
              {steps.map((step, idx) => {
                const isDone = idx < activeIdx;
                const isActive = idx === activeIdx && !isCancelled;
                const isFuture = idx > activeIdx && !isCancelled;

                return (
                  <div
                    key={step.key}
                    className={`${styles.step}
                      ${isDone ? styles.stepDone : ''}
                      ${isActive ? styles.stepActive : ''}
                      ${isFuture ? styles.stepFuture : ''}`}
                  >
                    {/* Connector line */}
                    {idx < steps.length - 1 && (
                      <div
                        className={styles.connector}
                        style={{ background: isDone ? accentColor : 'var(--border)' }}
                      />
                    )}

                    {/* Marker */}
                    <div
                      className={styles.marker}
                      style={{
                        background: isDone ? accentColor : isActive ? `${accentColor}20` : 'var(--bg-300)',
                        borderColor: isDone || isActive ? accentColor : 'var(--border)',
                        color: isDone ? '#000' : isActive ? accentColor : 'var(--text-400)',
                      }}
                    >
                      {isDone
                        ? <CheckCircle size={14} />
                        : isActive
                        ? <span className={styles.activeDot} style={{ background: accentColor }} />
                        : <span className={styles.futureDot} />}
                    </div>

                    {/* Label */}
                    <div className={styles.stepBody}>
                      <p
                        className={styles.stepLabel}
                        style={{ color: isDone || isActive ? 'var(--text-100)' : 'var(--text-400)' }}
                      >
                        {step.label}
                        {isActive && <span className={styles.nowBadge}>NOW</span>}
                      </p>
                      <p className={styles.stepDesc}>{step.desc}</p>
                    </div>
                  </div>
                );
              })}

              {isCancelled && (
                <div className={styles.cancelledNote}>
                  <AlertTriangle size={16} color="#ef4444" />
                  Order {order.status === 'failed' ? 'failed' : 'was cancelled'}.
                  {order.rejection_reason && ` Reason: ${order.rejection_reason}`}
                </div>
              )}
            </div>
          </div>

          {/* Delivery agent info */}
          {delivery?.users && (
            <div className={`card ${styles.agentCard}`}>
              <h3 className={styles.sectionTitle}>Delivery Agent</h3>
              <div className={styles.agentRow}>
                <div className={styles.agentAvatar}>
                  <Truck size={20} color="var(--primary)" />
                </div>
                <div className={styles.agentInfo}>
                  <p className={styles.agentName}>{delivery.users.name || 'Agent Assigned'}</p>
                  <p className={styles.agentSub}>Campus Logistics</p>
                </div>
                {delivery.users.phone && (
                  <a href={`tel:${delivery.users.phone}`} className={`btn btn-ghost btn-sm ${styles.callBtn}`}>
                    Call
                  </a>
                )}
              </div>
              {order.delivery_code && (
                <div className={styles.codeBox}>
                  <p className={styles.codeLabel}>Verification Code</p>
                  <p className={styles.codeValue}>{order.delivery_code}</p>
                  <p className={styles.codeHint}>Show this to the delivery agent upon arrival</p>
                </div>
              )}
            </div>
          )}

          {/* Delivery info */}
          <div className={`card ${styles.detailCard}`}>
            <h3 className={styles.sectionTitle}>Delivery Info</h3>
            <div className={styles.detailRow}>
              <MapPin size={16} color="var(--primary)" />
              <div>
                <p className={styles.detailKey}>Shipping Address</p>
                <p className={styles.detailVal}>{order.shipping_address || 'Not provided'}</p>
              </div>
            </div>
            <div className={styles.detailRow}>
              <Truck size={16} color="var(--primary)" />
              <div>
                <p className={styles.detailKey}>Delivery Method</p>
                <p className={styles.detailVal}>
                  {order.delivery_method === 'platform' ? 'Platform Campus Logistics' : 'Vendor Self-Delivery'}
                  {order.delivery_scope && ` • ${order.delivery_scope === 'in-school' ? 'In-School' : 'Out-of-School'}`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Item card + Escrow ── */}
        <div className={styles.sideCol}>
          {/* Item */}
          <div className={`card ${styles.itemCard}`}>
            <img
              src={order.products?.media_urls?.[0]}
              alt={order.products?.title}
              className={styles.itemImg}
            />
            <div className={styles.itemBody}>
              <p className={styles.itemBrand}>{order.brands?.name}</p>
              <h3 className={styles.itemTitle}>{order.products?.title}</h3>
              <p className={styles.itemPrice}>{formatPrice(Number(order.total_amount))}</p>
              {order.variants_selected && Object.keys(order.variants_selected).length > 0 && (
                <p className={styles.itemVariants}>
                  {Object.entries(order.variants_selected).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                </p>
              )}
            </div>
          </div>

          {/* Escrow */}
          <div className={styles.escrowBox}>
            <ShieldCheck size={20} color="var(--primary)" />
            <p>Your payment is held in <strong>Escrow</strong>. Funds are only released to the vendor after delivery is confirmed.</p>
          </div>

          {/* Notification permission nudge */}
          <div className={styles.notifBox}>
            <Bell size={16} color="var(--primary)" />
            <p>Enable browser notifications to get instant alerts when your order status changes.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

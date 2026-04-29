'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Package, Truck, CheckCircle, Clock, MapPin, 
  ChevronLeft, Loader2, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/lib/utils';
import DeliveryMap from '@/components/DeliveryMap';
import styles from './track.module.css';

export default function TrackingPage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [delivery, setDelivery] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchTrack() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push(`/auth/login?redirect=/track/${id}`);
        return;
      }

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          products(title, media_urls),
          brands(name, logo_url)
        `)
        .eq('id', id)
        .single();

      if (error || !data) {
        setError('Order not found or access denied.');
      } else {
        setOrder(data);
        // Fetch delivery info
        const { data: delivData } = await supabase
          .from('deliveries')
          .select('*')
          .eq('order_id', id)
          .single();
        if (delivData) setDelivery(delivData);
      }
      setLoading(false);
    }
    fetchTrack();
  }, [id, router]);

  if (loading) {
    return (
      <div className={styles.loading}>
        <Loader2 className="anim-spin" size={32} />
        <p>Locating your package...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <AlertTriangle size={48} color="#ef4444" style={{ margin: '0 auto 1.5rem' }} />
        <h2>Tracking Error</h2>
        <p>{error}</p>
        <Link href="/dashboard/customer" className="btn btn-primary mt-4">Back to Dashboard</Link>
      </div>
    );
  }

  const steps = [
    { label: 'Order Placed', status: 'pending', done: true, date: order.created_at },
    { label: 'Payment Secured', status: 'paid', done: ['paid', 'ready', 'picked_up', 'in_transit', 'delivered', 'confirmed', 'completed'].includes(order.status) },
    { label: 'Ready for Pickup', status: 'ready', done: ['ready', 'picked_up', 'in_transit', 'delivered', 'confirmed', 'completed'].includes(order.status) },
    { label: 'In Transit', status: 'in_transit', done: ['in_transit', 'delivered', 'confirmed', 'completed'].includes(order.status) },
    { label: 'Delivered', status: 'delivered', done: ['delivered', 'confirmed', 'completed'].includes(order.status) },
  ];

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.header}>
        <Link href="/dashboard/customer" className={styles.backLink}>
          <ChevronLeft size={16} /> Dashboard
        </Link>
        <h1>Track Delivery</h1>
        <p className={styles.orderId}>Order #{order.id.slice(0, 12).toUpperCase()}</p>
      </div>

      <div className={styles.grid}>
        {/* Progress Tracker */}
        <div className={styles.colMain}>
          <div className={`card ${styles.trackCard}`}>
            <div className={styles.statusBanner}>
              <div className={styles.statusIcon}>
                <Truck size={24} />
              </div>
              <div>
                <h3>{order.status.replace('_', ' ').toUpperCase()}</h3>
                <p>Status updated on {new Date().toLocaleDateString()}</p>
              </div>
            </div>

            <div className={styles.stepper}>
              {steps.map((step, idx) => (
                <div key={idx} className={`${styles.step} ${step.done ? styles.stepDone : ''} ${order.status === step.status ? styles.stepActive : ''}`}>
                  <div className={styles.stepMarker}>
                    {step.done ? <CheckCircle size={16} /> : <div className={styles.dot} />}
                  </div>
                  <div className={styles.stepInfo}>
                    <h4>{step.label}</h4>
                    {step.date && <p>{new Date(step.date).toLocaleString()}</p>}
                  </div>
                  {idx < steps.length - 1 && <div className={styles.stepLine} />}
                </div>
              ))}
            </div>
            </div>

          {(order.status === 'in_transit' || order.status === 'delivered') && (
            <div className={`card ${styles.mapCard}`} style={{ height: '350px', padding: 0, overflow: 'hidden', position: 'relative' }}>
                <DeliveryMap 
                    lat={delivery?.live_location_lat || 7.6125} 
                    lng={delivery?.live_location_lng || 5.2345} 
                    riderName={delivery?.rider_name}
                />
            </div>
          )}

          <div className={`card ${styles.detailsCard}`}>
            <h3>Delivery Information</h3>
            <div className={styles.detailRow}>
              <MapPin size={18} />
              <div>
                <strong>Shipping Address</strong>
                <p>{order.shipping_address || 'Address not provided'}</p>
              </div>
            </div>
            <div className={styles.detailRow}>
              <Truck size={18} />
              <div>
                <strong>Method & Scope</strong>
                <p>
                    {order.delivery_method === 'platform' ? 'Campus Platform Logistics' : 'Vendor Self-Delivery'}
                    {order.delivery_scope && (' \u2022 ' + (order.delivery_scope === 'in-school' ? 'In-School' : 'Out-School'))}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar: Item Info */}
        <div className={styles.colSide}>
          <div className={`card ${styles.itemCard}`}>
            <div className={styles.itemImage}>
              <img src={order.products?.media_urls?.[0]} alt="" />
            </div>
            <div className={styles.itemInfo}>
              <h3>{order.products?.title}</h3>
              <p>Sold by {order.brands?.name}</p>
              <span className={styles.price}>{formatPrice(Number(order.total_amount))}</span>
            </div>
          </div>

          <div className={styles.escrowNotice}>
            <ShieldCheck size={20} />
            <p>Your money is safe in <strong>Escrow</strong>. We only release it to the vendor after you confirm delivery.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

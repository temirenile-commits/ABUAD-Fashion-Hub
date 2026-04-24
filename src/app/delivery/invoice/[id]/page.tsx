'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/lib/utils';
import { FileText, ArrowLeft, Printer, ShieldCheck, MapPin, Phone, User, Loader2 } from 'lucide-react';

export default function DeliveryInvoicePage() {
  const { id } = useParams();
  const router = useRouter();
  const [delivery, setDelivery] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInvoice() {
      const { data, error } = await supabase
        .from('deliveries')
        .select(`
          *,
          order:order_id (
            id,
            total_amount,
            shipping_address,
            customer:customer_id (name, email, phone),
            product:product_id (title),
            brand:brand_id (name, location_name, phone)
          )
        `)
        .eq('id', id)
        .single();

      if (error || !data) {
        console.error('Invoice fetch error:', error);
        setLoading(false);
        return;
      }

      setDelivery(data);
      setLoading(false);
    }
    fetchInvoice();
  }, [id]);

  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: 'var(--primary)' }}><Loader2 className="anim-spin" size={48} /></div>;
  if (!delivery) return <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff' }}><h2>Invoice Not Found</h2><button onClick={() => router.back()} className="btn btn-primary btn-sm">Go Back</button></div>;

  const order = delivery.order;

  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', padding: '20px', color: '#333' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', background: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
        
        {/* Header - Non-Printable */}
        <div style={{ padding: '15px 20px', background: '#000', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="no-print">
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <ArrowLeft size={18} /> Back
          </button>
          <button onClick={() => window.print()} style={{ background: 'var(--primary)', border: 'none', color: '#000', padding: '6px 12px', borderRadius: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
            <Printer size={16} /> Print
          </button>
        </div>

        {/* Invoice Content */}
        <div style={{ padding: '40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #eee', paddingBottom: '20px', marginBottom: '30px' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--primary)' }}>DELIVERY INVOICE</h1>
              <p style={{ margin: '5px 0', fontSize: '0.9rem', color: '#666' }}>Ref: #{delivery.id.slice(0, 8).toUpperCase()}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>ABUAD Fashion Hub</h2>
              <p style={{ margin: '5px 0', fontSize: '0.8rem', color: '#666' }}>{new Date(delivery.assigned_at).toLocaleDateString()}</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '30px' }}>
            <div>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#999', textTransform: 'uppercase', marginBottom: '8px' }}>Pickup From (Vendor)</p>
              <p style={{ margin: 0, fontWeight: 600 }}>{order.brand?.name}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', color: '#555', marginTop: '4px' }}>
                <MapPin size={14} /> {order.brand?.location_name || 'Vendor Location'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', color: '#555', marginTop: '2px' }}>
                <Phone size={14} /> {order.brand?.phone || 'N/A'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#999', textTransform: 'uppercase', marginBottom: '8px' }}>Deliver To (Customer)</p>
              <p style={{ margin: 0, fontWeight: 600 }}>{order.customer?.name || 'Customer'}</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px', fontSize: '0.85rem', color: '#555', marginTop: '4px' }}>
                <MapPin size={14} /> {order.shipping_address || 'Campus Dropoff'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px', fontSize: '0.85rem', color: '#555', marginTop: '2px' }}>
                <Phone size={14} /> {order.customer?.phone || 'N/A'}
              </div>
            </div>
          </div>

          <div style={{ background: '#fcfcfc', border: '1px solid #eee', borderRadius: '8px', padding: '20px', marginBottom: '30px' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#999', textTransform: 'uppercase', marginBottom: '12px' }}>Item Details</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>{order.product?.title}</p>
                <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#777' }}>Order ID: #{order.id.slice(0, 8)}</p>
              </div>
              <p style={{ margin: 0, fontWeight: 700 }}>{formatPrice(order.total_amount)}</p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px dashed #eee', paddingTop: '20px' }}>
            <div>
              <p style={{ fontSize: '0.75rem', color: '#999', marginBottom: '4px' }}>Delivery Status</p>
              <span style={{ 
                background: delivery.status === 'delivered' ? '#e6fffa' : '#fffaf0', 
                color: delivery.status === 'delivered' ? '#2c7a7b' : '#c05621',
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase'
              }}>
                {delivery.status.replace('_', ' ')}
              </span>
            </div>
            {delivery.status !== 'delivered' && (
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '0.75rem', color: '#999', marginBottom: '4px' }}>Pick-up Code</p>
                <p style={{ margin: 0, fontWeight: 800, fontSize: '1.2rem', color: '#000', letterSpacing: '1px' }}>{delivery.pickup_code || 'N/A'}</p>
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '20px', background: '#f8f9fa', textAlign: 'center', fontSize: '0.7rem', color: '#999' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', marginBottom: '5px', color: '#555' }}>
            <ShieldCheck size={14} color="var(--success)" /> Verified by ABUAD Fashion Hub Logistics
          </div>
          <p>This is a digitally generated invoice for internal campus logistics purposes.</p>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; padding: 0 !important; }
          div { box-shadow: none !important; border: none !important; }
        }
      `}</style>
    </div>
  );
}

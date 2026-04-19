'use client';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CreditCard, ShoppingBag, Truck, Lock, Loader2, CheckCircle, MapPin, Phone, ArrowRight, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/context/CartContext';
import { LiveProduct } from '@/components/ProductCard';
import { formatPrice } from '@/lib/utils';
import styles from './checkout.module.css';

function CheckoutContent() {
  const router = useRouter();
  const { cart, getCartTotal, clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  // Form State
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'platform' | 'vendor'>('platform');

  const deliveryFee = deliveryMethod === 'platform' ? 1500 : 0;
  const orderTotal = getCartTotal();
  const finalTotal = orderTotal + deliveryFee;

  useEffect(() => {
    async function initCheckout() {
      // 1. Check Auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push(`/auth/login?redirect=/checkout`);
        return;
      }
      setUser(session.user);

      // fetch profile details
      const { data: profile } = await supabase.from('users').select('*').eq('id', session.user.id).single();
      if (profile) {
        setName(profile.name || '');
        setPhone(profile.phone || '');
      }

      // 2. Check Cart
      if (cart.length === 0) {
        setDataLoading(false); // Let the UI show 'empty' state or redirect
        return;
      }

      setDataLoading(false);
    }
    initCheckout();
  }, [router, cart.length]);

  const handlePaystackCheckout = async () => {
    if (cart.length === 0 || !user) return;
    if (!address || !phone) {
      alert('Please fill in your delivery details.');
      return;
    }

    try {
      setLoading(true); // Show button spinner
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          totalAmount: finalTotal,
          deliveryMethod: deliveryMethod,
          shippingAddress: address,
          items: cart.map((item: LiveProduct & { quantity: number }) => ({
            brandId: item.brand_id,
            productId: item.id,
            quantity: item.quantity,
            price: item.price
          }))
        })
      });
      const data = await res.json();
      
      if (data.authorization_url) {
        clearCart(); 
        window.location.href = data.authorization_url;
      } else {
        if (data.error === 'STALE_CART_ITEMS') {
          alert('Some items in your cart are no longer available. We have reset your cart for safety.');
          clearCart();
          router.push('/explore');
        } else if (data.error === 'INACTIVE_VENDORS') {
          alert('One or more vendors in your cart are currently undergoing verification. Please check back soon!');
        } else {
          alert(data.error || 'Failed to initialize payment gateway.');
        }
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      alert('A connection error occurred.');
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  if (dataLoading) {
    return (
      <div className={styles.loadingState}>
        <Loader2 className="anim-spin" size={32} />
        <p>Securing checkout session...</p>
      </div>
    );
  }

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.header}>
        <Link href="/explore" className={styles.backLink}>
          <ArrowRight style={{ transform: 'rotate(180deg)' }} size={16} /> Continue Shopping
        </Link>
        <h1 className={styles.title}>Secure Checkout</h1>
      </div>

      {cart.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <ShoppingBag size={48} style={{ margin: '0 auto 1.5rem', opacity: 0.3 }} />
          <h2>Your cart is empty</h2>
          <p style={{ color: 'var(--text-400)', marginBottom: '1.5rem' }}>Add some campus fashion to your bag before checking out.</p>
          <Link href="/explore" className="btn btn-primary">Browse Products</Link>
        </div>
      ) : (
        <div className={styles.checkoutGrid}>
          {/* ... (Left Col: Forms) */}
          <div className={styles.colMain}>
            {/* Same form as before */}
            <section className="card">
              <h2 className={styles.sectionTitle}><Truck size={18} /> Delivery Details</h2>
              <div className={styles.formGrid}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <div className={styles.inputWrap}>
                    <User size={16} className={styles.inputIcon} />
                    <input className="form-input" placeholder="e.g. John Doe" value={name} onChange={e => setName(e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Hostel / Campus Address *</label>
                  <div className={styles.inputWrap}>
                    <MapPin size={16} className={styles.inputIcon} />
                    <input className="form-input" placeholder="e.g. Afe Babalola Hall, Block A, Room 12" value={address} onChange={e => setAddress(e.target.value)} required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number *</label>
                  <div className={styles.inputWrap}>
                    <Phone size={16} className={styles.inputIcon} />
                    <input className="form-input" placeholder="e.g. 08123456789" value={phone} onChange={e => setPhone(e.target.value)} required />
                  </div>
                </div>
              </div>

              <div className={styles.deliveryToggle}>
                <h3>Delivery Method</h3>
                <div className={`${styles.deliveryOption} ${deliveryMethod === 'platform' ? styles.deliveryActive : ''}`} onClick={() => setDeliveryMethod('platform')}>
                  <div className={styles.radioBox}>
                    {deliveryMethod === 'platform' && <CheckCircle size={14} />}
                  </div>
                  <div className={styles.deliveryInfo}>
                    <strong>Platform Delivery</strong>
                    <span>Fast, tracked campus delivery. ₦1,500</span>
                  </div>
                </div>
                <div className={`${styles.deliveryOption} ${deliveryMethod === 'vendor' ? styles.deliveryActive : ''}`} onClick={() => setDeliveryMethod('vendor')}>
                  <div className={styles.radioBox}>
                    {deliveryMethod === 'vendor' && <CheckCircle size={14} />}
                  </div>
                  <div className={styles.deliveryInfo}>
                    <strong>Vendor Delivery</strong>
                    <span>Vendor manually delivers. Free.</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="card">
              <h2 className={styles.sectionTitle}><CreditCard size={18} /> Payment Information</h2>
              <div className={styles.escrowNotice}>
                <Lock size={16} />
                <p>
                  <strong>Escrow Protection:</strong> Your payment is held securely by ABUAD Fashion Hub. 
                  Vendors do not receive funds until you confirm delivery.
                </p>
              </div>
              
              <button 
                className={`btn btn-primary btn-lg ${styles.payBtn}`}
                onClick={handlePaystackCheckout}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="anim-spin" size={18} />
                    Initializing Secure Gateway...
                  </>
                ) : (
                  `Pay ${formatPrice(finalTotal)} with Paystack`
                )}
              </button>
              <p className={styles.termsNote}>
                By clicking "Pay", you agree to the ABUAD Fashion Hub <Link href="/terms">Terms of Service</Link> and recognize that funds will be held in escrow until delivery is confirmed.
              </p>
            </section>
          </div>

          {/* Right Col: Summary */}
          <div className={styles.colSidebar}>
            <div className={`card ${styles.summaryCard}`}>
              <h2>Order Summary</h2>
              
              {cart.map((item: LiveProduct & { quantity: number }) => (
                <div key={item.id} className={styles.summaryItem}>
                  <div className={styles.itemImage}>
                    <img src={item.media_urls?.[0]} alt={item.title} />
                  </div>
                  <div className={styles.itemDetails}>
                    <h4>{item.title}</h4>
                    <span>{item.brands?.name}</span>
                    <span>Qty: {item.quantity}</span>
                  </div>
                  <span className={styles.itemPrice}>{formatPrice(item.price * item.quantity)}</span>
                </div>
              ))}

              <div className={styles.totals}>
                <div className={styles.totalRow}>
                  <span>Subtotal</span>
                  <span>{formatPrice(orderTotal)}</span>
                </div>
                <div className={styles.totalRow}>
                  <span>{deliveryMethod === 'platform' ? 'Platform Delivery' : 'Vendor Delivery'}</span>
                  <span>{formatPrice(deliveryFee)}</span>
                </div>
                <div className={`${styles.totalRow} ${styles.totalFinal}`}>
                  <span>Total to Pay</span>
                  <span className="text-gradient" style={{ fontSize: '1.4rem' }}>{formatPrice(finalTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CheckoutContent />
    </Suspense>
  )
}

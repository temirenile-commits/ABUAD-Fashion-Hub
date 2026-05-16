/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
'use client';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CreditCard, ShoppingBag, Truck, Lock, Loader2, MapPin, Phone, ArrowRight, User, ShieldCheck, Clock } from 'lucide-react';
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
  const [user, setUser] = useState<any>(null); // Supabase user type is complex, keeping any for now but could use User from @supabase/supabase-js

  // Form State
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState<string | null>(null);
  const [promoAppliedData, setPromoAppliedData] = useState<{ id: string; code: string; type: string; value: number; product_id?: string } | null>(null);
  const [timeLeft, setTimeLeft] = useState(1800); // 30 minutes in seconds
  const [calculatedDeliveryFee, setCalculatedDeliveryFee] = useState(1500);
  const [, setDeliveryConfigs] = useState<{ id: string; delivery_scope: string; assigned_delivery_system: string }[]>([]);

  const deliveryFee = calculatedDeliveryFee;
  const orderTotal = getCartTotal();
  const calculatePromoSavings = () => {
    if (!promoAppliedData) return 0;
    let savings = 0;
    cart.forEach(item => {
      // If general promo OR specific to this product
      if (!promoAppliedData.product_id || promoAppliedData.product_id === item.id) {
        const itemSubtotal = item.price * (item.quantity || 1);
        if (promoAppliedData.type === 'percentage') {
          savings += itemSubtotal * (Number(promoAppliedData.value) / 100);
        } else if (promoAppliedData.type === 'fixed') {
          // For fixed, we apply it to the first eligible item we find (simplification)
          if (savings === 0) savings += Number(promoAppliedData.value);
        }
      }
    });
    return Math.round(savings);
  };

  const promoSavings = calculatePromoSavings();
  const finalTotal = orderTotal - promoSavings + deliveryFee;

  const handlePromoCode = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    try {
      const { data: promo, error } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', promoCode.trim().toUpperCase())
        .eq('is_active', true)
        .single();

      if (error || !promo) {
        alert('❌ Invalid or expired promo code.');
        setPromoAppliedData(null);
        setPromoApplied(null);
      } else {
        // Check if promo applies to anything in cart
        const appliesToAny = !promo.product_id || cart.some(item => item.id === promo.product_id);
        if (!appliesToAny) {
            alert('❌ This promo code does not apply to any items in your cart.');
            setPromoAppliedData(null);
            setPromoApplied(null);
        } else {
            setPromoAppliedData(promo);
            setPromoApplied(promo.code);
            alert(`✅ Promo code applied! ${promo.type === 'percentage' ? promo.value + '%' : formatPrice(promo.value)} off eligible items.`);
        }
      }
    } catch {
      alert('Error validating promo code.');
    }
    setPromoLoading(false);
  };


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
        // Auto-fill address from hostel and room number
        if (profile.hostel) {
          const fullAddress = profile.room_number 
            ? `${profile.hostel}, ${profile.room_number}`
            : profile.hostel;
          setAddress(fullAddress);
        }
      }

      // 2. Check Cart
      if (cart.length === 0) {
        setDataLoading(false);
        return;
      }

      // Fetch delivery settings for all vendors in cart
      const brandIds = Array.from(new Set(cart.map(item => item.brand_id)));
      const { data: vendorConfigs } = await supabase
        .from('brands')
        .select('id, delivery_scope, assigned_delivery_system')
        .in('id', brandIds);

      if (vendorConfigs) {
        const hasOutSchool = vendorConfigs.some(v => v.delivery_scope === 'out-school');
        const hasPlatform = vendorConfigs.some(v => v.assigned_delivery_system === 'platform');
        
        let fee = 0;
        if (hasPlatform) {
          fee = hasOutSchool ? 3000 : 1500;
        }

        // DELICACIES FIX: If any product is a delicacy, we use per-product delivery rates already in subtotal
        const isDelicacyBatch = cart.some(item => item.product_section === 'delicacies');
        if (isDelicacyBatch) fee = 0;

        setCalculatedDeliveryFee(fee);
        setDeliveryConfigs(vendorConfigs);
      }

      setDataLoading(false);
    }
    initCheckout();

    // 3. 30-Minute Security Timer
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          alert('⏰ Security window expired. Please refresh the page to start a new checkout session.');
          router.push('/cart');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router, cart.length, cart]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
          // Delivery info is now inferred on server from vendor configs
          shippingAddress: address,
          promoCode: promoApplied,
          items: cart.map((item: LiveProduct & { quantity: number; variants_selected?: Record<string, string> }) => ({
            brandId: item.brand_id,
            productId: item.id,
            quantity: item.quantity,
            price: item.price,
            variants_selected: item.variants_selected || null,
            is_preorder: item.is_preorder || false,
            preorder_arrival_date: item.preorder_arrival_date || null
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
      {/* AFFIRMATIVE LOADING OVERLAY */}
      {loading && (
        <div className={styles.secureOverlay}>
           <div className={styles.secureBox}>
              <div className={styles.lockPulse}>
                 <Lock size={40} className={styles.goldLock} />
              </div>
              <h2>Secure Payment Hub</h2>
              <p>Connecting to Paystack Gateway...</p>
              <div className={styles.progressBar}>
                 <div className={styles.progressFill} />
              </div>
              <span className={styles.encryptionNote}>
                 <ShieldCheck size={14} /> End-to-End Encrypted
              </span>
           </div>
        </div>
      )}

      <div className={styles.header}>
        <Link href="/explore" className={styles.backLink}>
          <ArrowRight style={{ transform: 'rotate(180deg)' }} size={16} /> Continue Shopping
        </Link>
        <h1 className={styles.title}>Secure Checkout</h1>
        <div className={styles.securityTimer}>
          <Clock size={16} /> 
          <span>Session expires in: <strong>{formatTime(timeLeft)}</strong></span>
        </div>
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
                    <input className="form-input" placeholder="e.g. University Hall, Block A, Room 12" value={address} onChange={e => setAddress(e.target.value)} required />
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

              <div className={styles.deliveryStatus}>
                <div className={styles.deliveryBadge}>
                   <Truck size={16} /> 
                    {deliveryFee > 0 ? (
                      <span>Fixed Platform Delivery: {formatPrice(deliveryFee)}</span>
                    ) : cart.some(item => item.product_section === 'delicacies') ? (
                      <span>Delicacy Delivery: Included in Price</span>
                    ) : (
                      <span>Vendor Managed Delivery: FREE</span>
                    )}
                </div>
                <p className={styles.deliveryNote}>
                  {deliveryFee > 0 
                    ? "Logistics are managed by Master Cart for safety and speed."
                    : "The vendor will contact you directly to arrange delivery."
                  }
                </p>
              </div>
            </section>

            <section className="card">
              <h2 className={styles.sectionTitle}><CreditCard size={18} /> Payment Information</h2>
              <div className={styles.escrowNotice}>
                <Lock size={16} />
                <p>
                  <strong>Escrow Protection:</strong> Your payment is held securely by Master Cart. 
                  Vendors do not receive funds until you confirm delivery.
                </p>
              </div>

              {/* Promo Code */}
              <div style={{ marginBottom: '1.25rem', padding: '1rem', background: 'var(--bg-200)', borderRadius: 12, border: '1px solid var(--border)' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>🎟️ Promo Code</label>
                {promoApplied ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ color: '#10b981', fontWeight: 700 }}>✅ &quot;{promoApplied}&quot; applied — {promoAppliedData?.type === 'percentage' ? promoAppliedData.value + '%' : formatPrice(promoAppliedData?.value || 0)} off!</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setPromoApplied(null); setPromoAppliedData(null); setPromoCode(''); }}>Remove</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      className="form-input"
                      placeholder="Enter promo code (optional)"
                      value={promoCode}
                      onChange={e => setPromoCode(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === 'Enter' && handlePromoCode()}
                      style={{ flex: 1, letterSpacing: '0.05em', fontWeight: 600 }}
                    />
                    <button className="btn btn-secondary btn-sm" onClick={handlePromoCode} disabled={promoLoading}>
                      {promoLoading ? '...' : 'Apply'}
                    </button>
                  </div>
                )}
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
                By clicking &quot;Pay&quot;, you agree to the Master Cart <Link href="/terms">Terms of Service</Link> and recognize that funds will be held in escrow until delivery is confirmed.
              </p>
            </section>
          </div>

          {/* Right Col: Summary */}
          <div className={styles.colSidebar}>
            <div className={`card ${styles.summaryCard}`}>
              <h2>Order Summary</h2>
              
              {cart.map((item: any) => (
                <div key={item.id} className={styles.summaryItem}>
                  <div className={styles.itemImage}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.media_urls?.[0]} alt={item.title} />
                  </div>
                  <div className={styles.itemDetails}>
                    <h4>{item.title}</h4>
                    <span>{item.brands?.name}</span>
                    <span>Qty: {item.quantity}</span>
                    {item.variants_selected && Object.keys(item.variants_selected).length > 0 && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-300)', marginTop: '4px' }}>
                        {Object.entries(item.variants_selected).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                      </div>
                    )}
                    {item.is_preorder && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '2px', fontWeight: 600 }}>
                        [Pre-order] Arrives: {item.preorder_arrival_date ? new Date(item.preorder_arrival_date).toLocaleDateString() : 'TBD'}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <span className={styles.itemPrice}>{formatPrice((Number(item.price) + Number(item.commission_price || 0) + Number(item.delivery_rate || 0)) * item.quantity)}</span>
                    {item.product_section === 'delicacies' && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '0.7rem', color: 'var(--text-300)', marginTop: '2px' }}>
                        <span>Item: {formatPrice(Number(item.price) * item.quantity)}</span>
                        {Number(item.commission_price) > 0 && <span>Platform Fee: {formatPrice(Number(item.commission_price) * item.quantity)}</span>}
                        {Number(item.delivery_rate) > 0 && <span>Delivery: {formatPrice(Number(item.delivery_rate) * item.quantity)}</span>}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              <div className={styles.totals}>
                <div className={styles.totalRow}>
                  <span>Subtotal</span>
                  <span>{formatPrice(orderTotal)}</span>
                </div>
                {promoSavings > 0 && (
                  <div className={styles.totalRow} style={{ color: '#10b981' }}>
                    <span>Promo Discount ({promoAppliedData?.type === 'percentage' ? promoAppliedData.value + '%' : 'Applied'})</span>
                    <span>-{formatPrice(promoSavings)}</span>
                  </div>
                )}
                <div className={styles.totalRow}>
                  <span>Delivery Fee</span>
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

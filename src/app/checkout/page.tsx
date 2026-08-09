/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
'use client';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CreditCard, ShoppingBag, Truck, Lock, Loader2, MapPin, Phone, ArrowRight, User, ShieldCheck, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/context/CartContext';
import { LiveProduct } from '@/components/ProductCard';
import { formatPrice, calculateActivePrice } from '@/lib/utils';
import { calculateItemFinances, defaultFinancialEngineConfig } from '@/lib/financialEngine';
import styles from './checkout.module.css';

function CheckoutContent() {
  const router = useRouter();
  const { cart, getCartTotal, clearCart } = useCart();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [user, setUser] = useState<any>(null); // Supabase user type is complex, keeping any for now but could use User from @supabase/supabase-js

  // Manual payment states
  const [manualBankSettings, setManualBankSettings] = useState<any>(null);
  const [senderBank, setSenderBank] = useState('');
  const [senderAccount, setSenderAccount] = useState('');
  const [transferReference, setTransferReference] = useState('');

  // Dynamic bank lookup states
  const [senderBankCode, setSenderBankCode] = useState('');
  const [senderAccountNumber, setSenderAccountNumber] = useState('');
  const [resolvingSenderAccount, setResolvingSenderAccount] = useState(false);
  const [availableBanks, setAvailableBanks] = useState<any[]>([]);
  const hasManual = cart.some(item => item.payment_system === 'manual');
  // Fetch bank list if manual payment is needed
  useEffect(() => {
    if (!hasManual) return;
    const loadBanks = async () => {
      try {
        const res = await fetch('/api/paystack/banks');
        const d = await res.json();
        if (d.success) setAvailableBanks(d.data || []);
      } catch (err) {
        console.error('Failed to load banks', err);
      }
    };
    loadBanks();
  }, [hasManual]);

  // Auto-resolve customer's bank details
  useEffect(() => {
    const resolveAccount = async () => {
      if (senderAccountNumber.length === 10 && senderBankCode) {
        setResolvingSenderAccount(true);
        setSenderAccount('');
        try {
          const res = await fetch(`/api/paystack/resolve?accountNumber=${senderAccountNumber}&bankCode=${senderBankCode}`);
          const d = await res.json();
          if (d.success && d.data?.account_name) {
            setSenderAccount(d.data.account_name);
            const selectedBankObj = availableBanks.find(b => b.code === senderBankCode);
            setSenderBank(selectedBankObj?.name || '');
            setTransferReference(senderAccountNumber); // Account number acts as the unique reference
          } else {
            alert('Could not resolve bank account details. Please check the account number and bank.');
          }
        } catch (err) {
          console.error('Error resolving bank account', err);
        }
        setResolvingSenderAccount(false);
      }
    };
    resolveAccount();
  }, [senderAccountNumber, senderBankCode, availableBanks]);

  // Form State
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [autoFill, setAutoFill] = useState(true);
  const [savedAutoFill, setSavedAutoFill] = useState({ address: '', phone: '' });
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [savingDefault, setSavingDefault] = useState(false);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState<string | null>(null);
  const [promoAppliedData, setPromoAppliedData] = useState<{ id: string; code: string; type: string; value: number; product_id?: string } | null>(null);
  const [timeLeft, setTimeLeft] = useState(1800); // 30 minutes in seconds
  const [calculatedDeliveryFee, setCalculatedDeliveryFee] = useState(1500);
  const [, setDeliveryConfigs] = useState<{ id: string; delivery_scope: string; assigned_delivery_system: string }[]>([]);
  const [liveProductsMap, setLiveProductsMap] = useState<Record<string, any>>({});
  const [financialEngineConfig, setFinancialEngineConfig] = useState<any>(defaultFinancialEngineConfig);


  const deliveryFee = calculatedDeliveryFee;

  const calculateLiveCartTotal = () => {
    return cart.reduce((total, item) => {
      const live = liveProductsMap[item.id];
      const basePrice = live
        ? calculateActivePrice(live.price, live.variants, item.variants_selected)
        : calculateActivePrice(item.price, item.variants, item.variants_selected);

      if (item.product_section === 'delicacies') {
        const finances = calculateItemFinances(basePrice, item.quantity, financialEngineConfig);
        let overrideDel = 0;
        let overrideCom = 0;
        if (live) {
          if (Number(live.delivery_rate) > 0) overrideDel = Number(live.delivery_rate) * item.quantity;
          if (Number(live.commission_price) > 0) overrideCom = Number(live.commission_price) * item.quantity;
        } else {
          if (Number(item.delivery_rate) > 0) overrideDel = Number(item.delivery_rate) * item.quantity;
          if (Number(item.commission_price) > 0) overrideCom = Number(item.commission_price) * item.quantity;
        }
        
        const effectivePrice = finances.totalSubtotal + 
          (overrideDel > 0 ? overrideDel : finances.totalDeliveryFee) + 
          (overrideCom > 0 ? overrideCom : finances.totalCommission);
          
        return total + effectivePrice;
      } else {
        const commission = live ? Number(live.commission_price || 0) : Number(item.commission_price || 0);
        const delivery = live ? Number(live.delivery_rate || 0) : Number(item.delivery_rate || 0);
        const effectivePrice = basePrice + commission + delivery;
        return total + effectivePrice * item.quantity;
      }
    }, 0);
  };

  const orderTotal = calculateLiveCartTotal();

  const calculatePromoSavings = () => {
    if (!promoAppliedData) return 0;
    let savings = 0;
    cart.forEach(item => {
      // If general promo OR specific to this product
      if (!promoAppliedData.product_id || promoAppliedData.product_id === item.id) {
        const live = liveProductsMap[item.id];
        const basePrice = live
          ? calculateActivePrice(live.price, live.variants, item.variants_selected)
          : calculateActivePrice(item.price, item.variants, item.variants_selected);

        let itemSubtotal = 0;
        if (item.product_section === 'delicacies') {
          const finances = calculateItemFinances(basePrice, item.quantity, financialEngineConfig);
          
          let overrideDel = 0;
          let overrideCom = 0;
          if (live) {
            if (Number(live.delivery_rate) > 0) overrideDel = Number(live.delivery_rate) * item.quantity;
            if (Number(live.commission_price) > 0) overrideCom = Number(live.commission_price) * item.quantity;
          } else {
            if (Number(item.delivery_rate) > 0) overrideDel = Number(item.delivery_rate) * item.quantity;
            if (Number(item.commission_price) > 0) overrideCom = Number(item.commission_price) * item.quantity;
          }
          itemSubtotal = finances.totalSubtotal + 
            (overrideDel > 0 ? overrideDel : finances.totalDeliveryFee) + 
            (overrideCom > 0 ? overrideCom : finances.totalCommission);
        } else {
          const commission = live ? Number(live.commission_price || 0) : Number(item.commission_price || 0);
          const delivery = live ? Number(live.delivery_rate || 0) : Number(item.delivery_rate || 0);
          const effectivePrice = basePrice + commission + delivery;
          itemSubtotal = effectivePrice * (item.quantity || 1);
        }

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
        // Auto-fill address: prefer the saved default address, fall back to hostel + room
        const savedAddress = profile.default_address || '';
        const hostelAddress = profile.hostel
          ? (profile.room_number ? `${profile.hostel}, ${profile.room_number}` : profile.hostel)
          : '';
        const filledAddress = savedAddress || hostelAddress;
        setSavedAutoFill({ address: filledAddress, phone: profile.phone || '' });
        // Honor the user's stored auto-fill preference (default ON)
        const preferAutoFill = profile.auto_fill_checkout !== false;
        setAutoFill(preferAutoFill);
        if (!preferAutoFill) {
          setAddress('');
          setPhone('');
        } else {
          setAddress(filledAddress);
        }
      }

      // ── Bank account resolution (3-tier fallback) ─────────────────────────────
      // 1. Active university bank account (toggled ON by university admin)
      // 2. Per-university superadmin default (stored in platform_settings)
      // 3. Global platform manual payment default
      const firstCartUniId = cart[0]?.university_id;
      let bankInfo = null;

      if (firstCartUniId) {
        // Tier 1: Check for an actively-toggled university bank account
        const { data: activeUniBank } = await supabase
          .from('university_bank_accounts')
          .select('*')
          .eq('university_id', firstCartUniId)
          .eq('is_active', true)
          .maybeSingle();

        if (activeUniBank) {
          bankInfo = activeUniBank;
        }

        // Tier 2: Superadmin-set per-university default fallback
        if (!bankInfo) {
          const { data: uniDefaultBank } = await supabase
            .from('platform_settings')
            .select('value')
            .eq('key', `uni_default_bank_${firstCartUniId}`)
            .maybeSingle();
          if (uniDefaultBank?.value) {
            bankInfo = uniDefaultBank.value;
          }
        }
      }

      // Tier 3: Global platform default
      if (!bankInfo) {
        const { data: settingsData } = await supabase
          .from('platform_settings')
          .select('value')
          .eq('key', 'manual_payment_settings')
          .maybeSingle();
        if (settingsData?.value) {
          bankInfo = settingsData.value;
        }
      }

      if (bankInfo) {
        setManualBankSettings(bankInfo);
      }
      
      const { data: engineSettingsData } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'financial_engine_config')
        .maybeSingle();
      if (engineSettingsData?.value) {
        setFinancialEngineConfig(engineSettingsData.value);
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

      // Fetch live product details to override stale local cart pricing
      const productIds = Array.from(new Set(cart.map(item => item.id)));
      if (productIds.length > 0) {
        const { data: liveProductsData } = await supabase
          .from('products')
          .select('id, price, commission_price, delivery_rate, variants')
          .in('id', productIds);
        
        if (liveProductsData) {
          const map: Record<string, any> = {};
          liveProductsData.forEach(p => {
            map[p.id] = p;
          });
          setLiveProductsMap(map);
        }
      }

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

  const handleManualCheckout = async () => {
    if (cart.length === 0 || !user) return;
    if (!address || !phone) {
      alert('Please fill in your delivery details.');
      return;
    }
    if (!senderBank || !senderAccount || !transferReference) {
      alert('Please fill in all transaction confirmation details.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/checkout/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          totalAmount: finalTotal,
          shippingAddress: address,
          promoCode: promoApplied,
          senderBank,
          senderAccount,
          transferReference,
          items: cart.map((item: any) => ({
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
      if (data.success) {
        clearCart(); 
        router.push(`/checkout/success?ref=${data.reference}&system=manual`);
      } else {
        alert(data.message || data.error || 'Failed to submit manual checkout.');
      }
    } catch (err) {
      console.error(err);
      alert('A connection error occurred.');
    } finally {
      setLoading(false);
    }
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

                {/* Auto-fill toggle: restore or clear saved phone & address */}
                <div className={styles.autoFillRow}>
                  <label className={styles.autoFillLabel}>
                    <input
                      type="checkbox"
                      className={styles.autoFillCheck}
                      checked={autoFill}
                      onChange={async (e) => {
                        const next = e.target.checked;
                        setAutoFill(next);
                        if (next) {
                          setAddress(savedAutoFill.address);
                          setPhone(savedAutoFill.phone);
                        }
                        // Save the user's toggle preference on the profile
                        if (user) {
                          await supabase.from('users').update({ auto_fill_checkout: next }).eq('id', user.id);
                        }
                      }}
                    />
                    <span>Auto-fill saved phone &amp; address</span>
                  </label>
                  <span className={styles.autoFillHint}>
                    {autoFill ? 'Edit freely below — your edits apply to this order only' : 'Fields cleared — type your details manually'}
                  </span>
                </div>

                {/* Optional: persist edited fields as the new checkout defaults */}
                <div className={styles.autoFillRow}>
                  <label className={styles.autoFillLabel}>
                    <input
                      type="checkbox"
                      className={styles.autoFillCheck}
                      checked={saveAsDefault}
                      onChange={(e) => setSaveAsDefault(e.target.checked)}
                      disabled={savingDefault}
                    />
                    <span>Save these as my default checkout details</span>
                  </label>
                  {saveAsDefault && (
                    <button
                      className="btn btn-sm"
                      style={{ fontSize: '0.7rem', padding: '5px 10px' }}
                      disabled={savingDefault}
                      onClick={async () => {
                        if (!user) return;
                        setSavingDefault(true);
                        try {
                          const { error } = await supabase
                            .from('users')
                            .update({ phone: phone.trim(), default_address: address.trim() })
                            .eq('id', user.id);
                          if (error) throw error;
                          setSavedAutoFill({ address: address.trim(), phone: phone.trim() });
                          setSaveAsDefault(false);
                          alert('Default checkout details saved!');
                        } catch (err: any) {
                          alert(err.message || 'Failed to save defaults.');
                        } finally {
                          setSavingDefault(false);
                        }
                      }}
                    >
                      {savingDefault ? 'Saving...' : 'Apply & Save'}
                    </button>
                  )}
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
                    ? "Logistics are managed by MasterCart for safety and speed."
                    : "The vendor will contact you directly to arrange delivery."
                  }
                </p>
              </div>
            </section>

            <section className="card">
              <h2 className={styles.sectionTitle}><CreditCard size={18} /> Payment Information</h2>
              
              {hasManual ? (
                <div style={{ marginBottom: '1.5rem', padding: '1.25rem', background: '#18181B', borderRadius: 12, border: '1px dashed #27272A' }}>
                  <h3 style={{ fontSize: '1rem', color: '#FFFFFF', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ShieldCheck size={18} /> Manual Bank Transfer Required
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-300)', marginBottom: '1rem' }}>
                    Some delicacy items in your cart require manual payment verification. Please make a bank transfer of <strong style={{ color: 'var(--primary)' }}>{formatPrice(finalTotal)}</strong> to the official platform account below:
                  </p>

                  <div style={{ background: 'var(--bg-300)', padding: '1rem', borderRadius: 8, border: '1px solid var(--border)', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                      <span style={{ opacity: 0.7 }}>Bank Name:</span>
                      <strong style={{ color: 'var(--text-100)' }}>{manualBankSettings?.bank_name || 'ACCESS BANK'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                      <span style={{ opacity: 0.7 }}>Account Number:</span>
                      <strong style={{ color: 'var(--primary)', letterSpacing: '0.05em' }}>{manualBankSettings?.account_number || '1883669647'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ opacity: 0.7 }}>Account Name:</span>
                      <strong style={{ color: 'var(--text-100)' }}>{manualBankSettings?.account_name || 'Enioluwa Temitope Olaide'}</strong>
                    </div>
                  </div>

                  <h4 style={{ fontSize: '0.85rem', marginBottom: '0.75rem', fontWeight: 600 }}>Submit Your Transfer Details:</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div className="form-group">
                      <label style={{ fontSize: '0.75rem', opacity: 0.8, display: 'block', marginBottom: '0.25rem' }}>Select Your Bank *</label>
                      <select 
                        className="form-input" 
                        value={senderBankCode} 
                        onChange={e => setSenderBankCode(e.target.value)} 
                        required
                        style={{ background: 'var(--bg-100)', color: 'var(--text-100)' }}
                      >
                        <option value="">-- Choose Your Bank --</option>
                        {availableBanks.map((b: any) => (
                          <option key={b.code} value={b.code}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '0.75rem', opacity: 0.8, display: 'block', marginBottom: '0.25rem' }}>Your Account Number *</label>
                      <input 
                        type="text" 
                        maxLength={10}
                        className="form-input" 
                        placeholder="Enter 10-digit account number" 
                        value={senderAccountNumber} 
                        onChange={e => setSenderAccountNumber(e.target.value.replace(/\D/g, ''))} 
                        required 
                      />
                    </div>
                    {resolvingSenderAccount && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Loader2 size={12} className="anim-spin" /> Resolving account name...
                      </div>
                    )}
                    {senderAccount && (
                      <div style={{ padding: '0.75rem', background: '#1F1F23', border: '1px solid #3F3F46', borderRadius: '8px', fontSize: '0.85rem' }}>
                        <span style={{ opacity: 0.7, display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '0.15rem', color: '#FFFFFF' }}>Verified Account Name</span>
                        <strong style={{ color: '#FFFFFF' }}>{senderAccount}</strong>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className={styles.escrowNotice}>
                  <Lock size={16} />
                  <p>
                    <strong>Escrow Protection:</strong> Your payment is held securely by MasterCart. 
                    Vendors do not receive funds until you confirm delivery.
                  </p>
                </div>
              )}

              {/* Promo Code */}
              <div style={{ marginBottom: '1.25rem', padding: '1rem', background: 'var(--bg-200)', borderRadius: 12, border: '1px solid var(--border)' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>🎟️ Promo Code</label>
                {promoApplied ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ color: '#FFFFFF', fontWeight: 700 }}>✅ &quot;{promoApplied}&quot; applied — {promoAppliedData?.type === 'percentage' ? promoAppliedData.value + '%' : formatPrice(promoAppliedData?.value || 0)} off!</span>
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
              
              {hasManual ? (
                <button 
                  className={`btn btn-primary btn-lg ${styles.payBtn}`}
                  onClick={handleManualCheckout}
                  disabled={loading || !senderBank || !senderAccount || !transferReference}
                  style={{ background: 'linear-gradient(135deg, #FFFFFF 0%, #FFFFFF 100%)', borderColor: '#27272A' }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="anim-spin" size={18} />
                      Submitting for Admin Verification...
                    </>
                  ) : (
                    `Submit ${formatPrice(finalTotal)} Manual Transfer`
                  )}
                </button>
              ) : (
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
              )}
              
              <p className={styles.termsNote}>
                By clicking &quot;Pay&quot; or &quot;Submit&quot;, you agree to the MasterCart <Link href="/terms">Terms of Service</Link> and recognize that funds will be held in escrow until delivery is confirmed.
              </p>
            </section>
          </div>

          {/* Right Col: Summary */}
          <div className={styles.colSidebar}>
            <div className={`card ${styles.summaryCard}`}>
              <h2>Order Summary</h2>
              
              {cart.map((item: any) => {
                const live = liveProductsMap[item.id];
                const activePrice = live
                  ? calculateActivePrice(live.price, live.variants, item.variants_selected)
                  : calculateActivePrice(item.price, item.variants, item.variants_selected);
                const commission = live ? Number(live.commission_price || 0) : Number(item.commission_price || 0);
                const deliveryRate = live ? Number(live.delivery_rate || 0) : Number(item.delivery_rate || 0);
                const isDelicacy = item.product_section === 'delicacies';

                const totalItemPrice = (activePrice + commission + deliveryRate) * item.quantity;
                return (
                  <div key={item.id} className={styles.summaryItem}>
                    <div className={styles.itemImage}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.media_urls?.[0]} alt={item.title} />
                    </div>
                    <div className={styles.itemDetails}>
                      <h4>{item.title}</h4>
                      <span>{item.brands?.name}</span>
                      <span>Qty: {item.quantity}</span>
                      {item.variants_selected && Object.keys(item.variants_selected).length > 0 ? (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-300)', marginTop: '4px' }}>
                          {Object.entries(item.variants_selected).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                        </div>
                      ) : null}
                      {item.is_preorder && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '2px', fontWeight: 600 }}>
                          [Pre-order] Arrives: {item.preorder_arrival_date ? new Date(item.preorder_arrival_date).toLocaleDateString() : 'TBD'}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', minWidth: '80px' }}>
                      <span className={styles.itemPrice}>{formatPrice(totalItemPrice)}</span>
                      {isDelicacy && (commission > 0 || deliveryRate > 0) && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '0.68rem', color: 'var(--text-400)', lineHeight: 1.5, marginTop: '2px' }}>
                          <span>Item: {formatPrice(activePrice * item.quantity)}</span>
                          {commission > 0 && <span style={{ color: '#FFFFFF' }}>Comm: +{formatPrice(commission * item.quantity)}</span>}
                          {deliveryRate > 0 && <span style={{ color: '#000000' }}>Delivery: +{formatPrice(deliveryRate * item.quantity)}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              <div className={styles.totals}>
                <div className={styles.totalRow}>
                  <span>Subtotal</span>
                  <span>{formatPrice(orderTotal)}</span>
                </div>
                {promoSavings > 0 && (
                  <div className={styles.totalRow} style={{ color: '#FFFFFF' }}>
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

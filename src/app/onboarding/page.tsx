'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Store,
  User,
  Camera,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Upload,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from './onboarding.module.css';

const STEPS = [
  { id: 1, label: 'Account Type', icon: <User size={20} /> },
  { id: 2, label: 'Brand Details', icon: <Store size={20} /> },
  { id: 3, label: 'Upload Assets', icon: <Camera size={20} /> },
  { id: 4, label: 'Terms', icon: <Layers size={20} /> },
  { id: 5, label: 'Verification', icon: <ShieldCheck size={20} /> },
];

const VENDOR_TYPES = [
  { value: 'product', label: 'Product Seller', desc: 'Sell clothing, footwear, bags, jewelry & accessories', icon: '🛍️' },
  { value: 'service', label: 'Service Provider', desc: 'Offer makeup, photography, tailoring, styling', icon: '✨' },
  { value: 'both', label: 'Both', desc: 'Sell products AND offer fashion services', icon: '🌟' },
];

const PRODUCT_CATEGORIES = ['Clothing', 'Footwear', 'Bags', 'Accessories', 'Jewelry', 'Others'];
const SERVICE_TYPES = ['Makeup Artist', 'Fashion Designer', 'Stylist', 'Photographer', 'Hair Stylist'];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [vendorType, setVendorType] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [form, setForm] = useState({
    brandName: '',
    description: '',
    category: '',
    serviceType: '',
    whatsapp: '',
    instagram: '',
  });

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/login?redirect=/onboarding');
      } else {
        setUser(session.user);
      }
    };
    checkUser();
  }, [router]);

  const next = () => setStep((s) => Math.min(s + 1, 5));
  const prev = () => setStep((s) => Math.max(s - 1, 1));

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);
    setErrorMsg('');

    try {
      // 1. Create the Brand
      const { data: brand, error: brandError } = await supabase
        .from('brands')
        .insert({
          owner_id: user.id,
          name: form.brandName,
          description: form.description,
          whatsapp_number: form.whatsapp,
          verified: false,
          delivery_preference: 'platform',
          subscription_plan: 'free',
          terms_accepted: acceptedTerms,
        })
        .select()
        .single();

      if (brandError) throw brandError;

      // 2. Update user role in public.users to 'vendor'
      const { error: userUpdateError } = await supabase
        .from('users')
        .update({ role: 'vendor' })
        .eq('id', user.id);

      if (userUpdateError) throw userUpdateError;

      // 3. Success -> Dashboard
      router.push('/dashboard/vendor');

    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || 'An error occurred during brand registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container">
      <div className={styles.page}>
        {/* Header */}
        <div className={styles.header}>
          <h1>Start Selling on ABUAD Fashion Hub</h1>
          <p>Join campus brands already growing their business — it&apos;s free!</p>
        </div>

        {errorMsg && (
          <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', marginBottom: '1.5rem', textAlign: 'center' }}>
            {errorMsg}
          </div>
        )}

        {/* Progress Stepper */}
        <div className={styles.stepper}>
          {STEPS.map((s, i) => (
            <div key={s.id} className={styles.stepperItem}>
              <div className={`${styles.stepCircle} ${step >= s.id ? styles.stepDone : ''} ${step === s.id ? styles.stepActive : ''}`}>
                {step > s.id ? <CheckCircle size={16} /> : s.icon}
              </div>
              <span className={`${styles.stepLabel} ${step === s.id ? styles.stepLabelActive : ''}`}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <div className={`${styles.stepLine} ${step > s.id ? styles.stepLineDone : ''}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className={`card ${styles.card}`}>

          {/* ── STEP 1: Account Type ── */}
          {step === 1 && (
            <div className={styles.stepContent}>
              <h2 className={styles.stepTitle}>What do you want to offer?</h2>
              <p className={styles.stepDesc}>Choose what best describes your business on campus.</p>

              <div className={styles.typeGrid}>
                {VENDOR_TYPES.map((type) => (
                  <button
                    key={type.value}
                    className={`${styles.typeCard} ${vendorType === type.value ? styles.typeSelected : ''}`}
                    onClick={() => setVendorType(type.value)}
                  >
                    <span className={styles.typeEmoji}>{type.icon}</span>
                    <h3>{type.label}</h3>
                    <p>{type.desc}</p>
                    {vendorType === type.value && (
                      <div className={styles.typeCheck}><CheckCircle size={18} /></div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 2: Brand Details ── */}
          {step === 2 && (
            <div className={styles.stepContent}>
              <h2 className={styles.stepTitle}>Tell us about your brand</h2>
              <p className={styles.stepDesc}>This is how customers will find and recognize you.</p>

              <div className={styles.formGrid}>
                <div className="form-group">
                  <label className="form-label">Brand / Shop Name *</label>
                  <input
                    className="form-input"
                    placeholder="e.g. RetroFits ABUAD"
                    value={form.brandName}
                    onChange={(e) => setForm({ ...form, brandName: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Brief Description *</label>
                  <textarea
                    className={`form-input ${styles.textarea}`}
                    placeholder="What do you sell or offer? What makes your brand unique?"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>

                {(vendorType === 'product' || vendorType === 'both') && (
                  <div className="form-group">
                    <label className="form-label">Primary Product Category *</label>
                    <div className={styles.optionPills}>
                      {PRODUCT_CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          className={`${styles.optPill} ${form.category === cat ? styles.optActive : ''}`}
                          onClick={() => setForm({ ...form, category: cat })}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {(vendorType === 'service' || vendorType === 'both') && (
                  <div className="form-group">
                    <label className="form-label">Service Type *</label>
                    <div className={styles.optionPills}>
                      {SERVICE_TYPES.map((svc) => (
                        <button
                          key={svc}
                          className={`${styles.optPill} ${form.serviceType === svc ? styles.optActive : ''}`}
                          onClick={() => setForm({ ...form, serviceType: svc })}
                        >
                          {svc}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">WhatsApp Contact Number *</label>
                  <input
                    className="form-input"
                    type="tel"
                    placeholder="+234 801 234 5678"
                    value={form.whatsapp}
                    onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Instagram Handle (optional)</label>
                  <input
                    className="form-input"
                    placeholder="@yourhandle"
                    value={form.instagram}
                    onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: Upload Assets (Simplified for now) ── */}
          {step === 3 && (
            <div className={styles.stepContent}>
              <h2 className={styles.stepTitle}>Upload your brand assets</h2>
              <p className={styles.stepDesc}>Add a logo and product/portfolio photos to attract customers.</p>

              <div className={styles.uploadAreas}>
                <div className={styles.uploadBox}>
                  <Upload size={28} className={styles.uploadIcon} />
                  <h3>Brand Logo</h3>
                  <p>PNG, JPG or SVG — max 5MB</p>
                  <button className="btn btn-secondary btn-sm" disabled>Coming Soon</button>
                </div>

                <div className={`${styles.uploadBox} ${styles.uploadBoxLarge}`}>
                  <Upload size={28} className={styles.uploadIcon} />
                  <h3>Product / Portfolio Photos</h3>
                  <p>Upload up to 10 images (JPG, PNG — max 10MB each)</p>
                  <button className="btn btn-secondary btn-sm" disabled>Coming Soon</button>
                </div>
              </div>
              <p style={{ textAlign: 'center', color: 'var(--text-400)', marginTop: '1rem', fontSize: '0.9rem' }}>
                You can skip this step and upload directly from your dashboard later.
              </p>
            </div>
          )}

          {/* ── STEP 4: Terms & Conditions ── */}
          {step === 4 && (
            <div className={styles.stepContent}>
              <h2 className={styles.stepTitle}>Vendor Terms & Conditions</h2>
              <p className={styles.stepDesc}>Please review and accept our platform rules to continue.</p>
              
              <div className={styles.termsBox}>
                <h3>ABUAD FASHION HUB – VENDOR TERMS & CONDITIONS</h3>
                <p><strong>Effective Date: April 17, 2026</strong></p>
                
                <h4>1. Eligibility</h4>
                <ul>
                  <li>Vendors must be affiliated with ABRUAD (student, staff, or recognized entrepreneur).</li>
                  <li>Vendors must provide accurate registration information.</li>
                </ul>

                <h4>5. Listing Fees</h4>
                <ul>
                  <li>First 5 product/service listings are free.</li>
                  <li>Additional listings: ₦200 per listing OR ₦1,500 monthly subscription.</li>
                </ul>

                <h4>6. Commission Structure</h4>
                <ul>
                  <li>The Platform charges a commission of 7.5% – 10% on each completed transaction.</li>
                  <li>Commission is automatically deducted before payout.</li>
                </ul>

                <h4>7. Payments & Escrow</h4>
                <ul>
                  <li>All customer payments are processed through the Platform.</li>
                  <li>Funds are held in escrow until order completion.</li>
                  <li>Payouts released after customer confirms delivery or 24-48h auto-release.</li>
                </ul>

                <h4>9. Delivery Policy</h4>
                <p><strong>Option A: Platform Delivery</strong> — Platform manages riders.</p>
                <p><strong>Option B: Vendor Delivery</strong> — Vendor is solely responsible.</p>
                
                <p><em>... (Full Terms available in policy documents)</em></p>
              </div>

              <label className={styles.termsCheckbox}>
                <input 
                  type="checkbox" 
                  checked={acceptedTerms} 
                  onChange={(e) => setAcceptedTerms(e.target.checked)} 
                />
                <span>I have read and agree to the ABUAD Fashion Hub Vendor Terms & Conditions.</span>
              </label>
            </div>
          )}

          {/* ── STEP 5: Verification ── */}
          {step === 5 && (
            <div className={styles.stepContent}>
              <h2 className={styles.stepTitle}>Apply for Verified Badge</h2>
              <p className={styles.stepDesc}>
                Get the <strong>✅ Verified Badge</strong> for higher visibility and customer trust. Upload your documents below.
              </p>

              <div className={styles.verifyInfo}>
                <div className={styles.verifyItem}>
                  <CheckCircle size={16} style={{ color: 'var(--success)' }} />
                  <span>ABUAD Student ID Card</span>
                </div>
                <div className={styles.verifyItem}>
                  <CheckCircle size={16} style={{ color: 'var(--success)' }} />
                  <span>Proof of brand (portfolio, social media)</span>
                </div>
              </div>

              <div className={styles.uploadAreas}>
                <div className={styles.uploadBox}>
                  <ShieldCheck size={28} className={styles.uploadIcon} />
                  <h3>Student ID Card</h3>
                  <button className="btn btn-secondary btn-sm" disabled>Coming Soon</button>
                </div>
                <div className={styles.uploadBox}>
                  <Camera size={28} className={styles.uploadIcon} />
                  <h3>Brand Proof</h3>
                  <button className="btn btn-secondary btn-sm" disabled>Coming Soon</button>
                </div>
              </div>

              <div className={styles.skipVerify}>
                <span>You can finalize your brand registration now.</span>
                <button className={styles.skipBtn} onClick={handleSubmit} disabled={loading}>
                  {loading ? 'Finalizing...' : 'Finalize Registration →'}
                </button>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className={styles.navButtons}>
            {step > 1 ? (
              <button className="btn btn-ghost" onClick={prev} disabled={loading}>
                <ArrowLeft size={16} /> Back
              </button>
            ) : (
              <Link href="/" className="btn btn-ghost">
                Cancel
              </Link>
            )}

            {step < 5 ? (
              <button 
                className="btn btn-primary" 
                onClick={next} 
                disabled={(step === 1 && !vendorType) || (step === 4 && !acceptedTerms)}
              >
                Continue <ArrowRight size={16} />
              </button>
            ) : (
              <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                <CheckCircle size={16} /> {loading ? 'Finalizing...' : 'Finalize Registration'}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

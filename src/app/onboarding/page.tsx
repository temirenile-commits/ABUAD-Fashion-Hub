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
  const [logoUrl, setLogoUrl] = useState('');
  const [verificationUrls, setVerificationUrls] = useState<string[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);

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
        // Check if they already have a brand
        const { data: existingBrand } = await supabase.from('brands').select('*').eq('owner_id', session.user.id).single();
        if (existingBrand) {
          router.push('/dashboard/vendor');
        }
      }
    };
    checkUser();
  }, [router]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, bucket: 'brand-assets' | 'verification-docs') => {
    if (!e.target.files?.[0]) return;
    setLoading(true);
    const file = e.target.files[0];
    const { url, error } = await uploadFile(file, bucket, `${user.id}-${bucket}`);
    
    if (url) {
      if (bucket === 'brand-assets') setLogoUrl(url);
      else setVerificationUrls(prev => [...prev, url]);
      alert('Upload successful!');
    } else {
      alert(error || 'Upload failed');
    }
    setLoading(false);
  };

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
          verification_status: 'pending',
          is_verified: false,
          fee_paid: false,
          logo_url: logoUrl,
          verification_documents: verificationUrls,
          delivery_preference: 'platform',
          subscription_plan: 'free',
          terms_accepted: acceptedTerms,
        })
        .select()
        .single();

      if (brandError) throw brandError;

      // 2. Update user role 
      await supabase.from('users').update({ role: 'vendor' }).eq('id', user.id);

      setIsSubmitted(true);

    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || 'An error occurred during brand registration.');
    } finally {
      setLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className={`container ${styles.page}`}>
        <div className={`card ${styles.card}`} style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div className={styles.successIcon}><ShieldCheck size={64} color="var(--primary)" /></div>
          <h2>Application Submitted!</h2>
          <p style={{ margin: '1.5rem 0', color: 'var(--text-300)' }}>
            Your brand application is now under review. Our admins will verify your details within 24-48 hours. 
            Once approved, you will be prompted to pay the ₦2,000 activation fee to go live.
          </p>
          <Link href="/" className="btn btn-primary">Return to Marketplace</Link>
        </div>
      </div>
    );
  }

  return (
    <main className="container">
      <div className={styles.page}>
        {/* Header */}
        <div className={styles.header}>
          <h1>Start Selling on ABUAD Fashion Hub</h1>
          <p>Join campus brands already growing their business — precision-engineered for ABUAD.</p>
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

          {/* ── STEP 3: Upload Assets ── */}
          {step === 3 && (
            <div className={styles.stepContent}>
              <h2 className={styles.stepTitle}>Upload your brand logo</h2>
              <p className={styles.stepDesc}>Add a logo to represent your brand on the marketplace.</p>

              <div className={styles.uploadAreas}>
                <label className={styles.uploadBox}>
                  <input type="file" hidden accept="image/*" onChange={(e) => handleFileUpload(e, 'brand-assets')} />
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo Preview" style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '50%' }} />
                  ) : (
                    <>
                      <Upload size={28} className={styles.uploadIcon} />
                      <h3>Brand Logo</h3>
                      <p>Click to browse — PNG, JPG (Max 5MB)</p>
                    </>
                  )}
                </label>
              </div>
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
                
                <h4>Activation Fee</h4>
                <p>Upon admin approval, a one-time activation fee of <strong>₦2,000</strong> is required to set up your store and start listing products.</p>

                <h4>Listing Fees</h4>
                <ul>
                  <li>First 5 product/service listings are free.</li>
                  <li>Additional listings: ₦200 per listing OR ₦1,500 monthly subscription.</li>
                </ul>

                <p><em>... (Standard platform policies applied)</em></p>
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
              <h2 className={styles.stepTitle}>Submit Verification Documents</h2>
              <p className={styles.stepDesc}>
                Admin review is required. Please upload your Student ID or proof of business.
              </p>

              <div className={styles.uploadAreas}>
                <label className={styles.uploadBox}>
                  <input type="file" hidden onChange={(e) => handleFileUpload(e, 'verification-docs')} />
                  <ShieldCheck size={28} className={styles.uploadIcon} />
                  <h3>Upload Business Proof</h3>
                  <p>{verificationUrls.length} files attached</p>
                </label>
              </div>

              <div className={styles.skipVerify}>
                <button className={styles.skipBtn} onClick={handleSubmit} disabled={loading || verificationUrls.length === 0}>
                  {loading ? 'Submitting Application...' : 'Submit Application for Review →'}
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
              <button className="btn btn-primary" onClick={handleSubmit} disabled={loading || verificationUrls.length === 0}>
                <CheckCircle size={16} /> {loading ? 'Submitting...' : 'Submit Application'}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}


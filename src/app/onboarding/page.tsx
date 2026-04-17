'use client';
import { useState } from 'react';
import Link from 'next/link';
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
import styles from './onboarding.module.css';

const STEPS = [
  { id: 1, label: 'Account Type', icon: <User size={20} /> },
  { id: 2, label: 'Brand Details', icon: <Store size={20} /> },
  { id: 3, label: 'Upload Assets', icon: <Camera size={20} /> },
  { id: 4, label: 'Verification', icon: <ShieldCheck size={20} /> },
];

const VENDOR_TYPES = [
  { value: 'product', label: 'Product Seller', desc: 'Sell clothing, footwear, bags, jewelry & accessories', icon: '🛍️' },
  { value: 'service', label: 'Service Provider', desc: 'Offer makeup, photography, tailoring, styling', icon: '✨' },
  { value: 'both', label: 'Both', desc: 'Sell products AND offer fashion services', icon: '🌟' },
];

const PRODUCT_CATEGORIES = ['Clothing', 'Footwear', 'Bags', 'Accessories', 'Jewelry', 'Others'];
const SERVICE_TYPES = ['Makeup Artist', 'Fashion Designer', 'Stylist', 'Photographer', 'Hair Stylist'];

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [vendorType, setVendorType] = useState('');
  const [form, setForm] = useState({
    brandName: '',
    description: '',
    category: '',
    serviceType: '',
    whatsapp: '',
    instagram: '',
  });

  const next = () => setStep((s) => Math.min(s + 1, 4));
  const prev = () => setStep((s) => Math.max(s - 1, 1));

  return (
    <main className="container">
      <div className={styles.page}>
        {/* Header */}
        <div className={styles.header}>
          <h1>Start Selling on ABUAD Fashion Hub</h1>
          <p>Join 50+ campus brands already growing their business — it&apos;s free!</p>
        </div>

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
              <h2 className={styles.stepTitle}>Upload your brand assets</h2>
              <p className={styles.stepDesc}>Add a logo and product/portfolio photos to attract customers.</p>

              <div className={styles.uploadAreas}>
                <div className={styles.uploadBox}>
                  <Upload size={28} className={styles.uploadIcon} />
                  <h3>Brand Logo</h3>
                  <p>PNG, JPG or SVG — max 5MB</p>
                  <button className="btn btn-secondary btn-sm">Choose File</button>
                </div>

                <div className={`${styles.uploadBox} ${styles.uploadBoxLarge}`}>
                  <Upload size={28} className={styles.uploadIcon} />
                  <h3>Product / Portfolio Photos</h3>
                  <p>Upload up to 10 images (JPG, PNG — max 10MB each)</p>
                  <button className="btn btn-secondary btn-sm">Choose Files</button>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 4: Verification ── */}
          {step === 4 && (
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
                  <span>Proof of brand (social media page, product samples)</span>
                </div>
                <div className={styles.verifyItem}>
                  <Layers size={16} style={{ color: 'var(--accent)' }} />
                  <span>Admin review typically takes 24–48 hours</span>
                </div>
              </div>

              <div className={styles.uploadAreas}>
                <div className={styles.uploadBox}>
                  <ShieldCheck size={28} className={styles.uploadIcon} />
                  <h3>Student ID Card</h3>
                  <p>Clear scan or photo of your ABUAD ID</p>
                  <button className="btn btn-secondary btn-sm">Upload ID</button>
                </div>
                <div className={styles.uploadBox}>
                  <Camera size={28} className={styles.uploadIcon} />
                  <h3>Brand Proof</h3>
                  <p>Screenshot of your social media, or sample product photos</p>
                  <button className="btn btn-secondary btn-sm">Upload Proof</button>
                </div>
              </div>

              <div className={styles.skipVerify}>
                <span>You can skip verification for now and apply later from your dashboard.</span>
                <button className={styles.skipBtn}>Skip for now →</button>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className={styles.navButtons}>
            {step > 1 ? (
              <button className="btn btn-ghost" onClick={prev}>
                <ArrowLeft size={16} /> Back
              </button>
            ) : (
              <Link href="/" className="btn btn-ghost">
                Cancel
              </Link>
            )}

            {step < 4 ? (
              <button className="btn btn-primary" onClick={next} disabled={step === 1 && !vendorType}>
                Continue <ArrowRight size={16} />
              </button>
            ) : (
              <button className="btn btn-primary">
                <CheckCircle size={16} /> Submit Application
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

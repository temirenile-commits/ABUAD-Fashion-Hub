'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Store,
  User,
  GraduationCap,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  MessageCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from './onboarding.module.css';

const STEPS = [
  { id: 1, label: 'Account Type', icon: <User size={20} /> },
  { id: 2, label: 'Brand Details', icon: <Store size={20} /> },
  { id: 3, label: 'Verification', icon: <GraduationCap size={20} /> },
  { id: 4, label: 'Terms', icon: <ShieldCheck size={20} /> },
];

const ADMIN_WHATSAPP = "2348012345678"; // Replace with your actual number

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [vendorType, setVendorType] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(true);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const [form, setForm] = useState({
    brandName: '',
    description: '',
    category: 'Clothing',
    whatsapp: '',
    roomNo: '',
    matricNo: '',
    college: '',
    department: '',
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

  const next = () => setStep((s) => Math.min(s + 1, 4));
  const prev = () => setStep((s) => Math.max(s - 1, 1));

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);
    setErrorMsg('');

    try {
      // 1. Create the Brand with academic details
      const { data: brand, error: brandError } = await supabase
        .from('brands')
        .insert({
          owner_id: user.id,
          name: form.brandName,
          description: form.description,
          whatsapp_number: form.whatsapp,
          room_number: form.roomNo,
          matric_number: form.matricNo,
          college: form.college,
          department: form.department,
          verification_status: 'pending',
          verified: false,
          fee_paid: true, // We auto-mark fee as paid because we removed the naira fee
          delivery_preference: 'platform',
          subscription_tier: 'free',
          max_products: 0,
          max_reels: 0,
          terms_accepted: true,
          trial_started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (brandError) throw brandError;

      // 2. Update user role 
      await supabase.from('users').update({ role: 'vendor' }).eq('id', user.id);

      setIsSubmitted(true);
    } catch (err: any) {
      console.error('Registration failed:', err);
      setErrorMsg(err.message || 'An error occurred during brand registration.');
    } finally {
      setLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className={`container ${styles.page}`}>
        <div className={`card ${styles.card}`} style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div className={styles.successIcon}><ShieldCheck size={64} color="var(--primary)" /></div>
          <h2>Verification Pending!</h2>
          <p style={{ margin: '1.5rem 0', color: 'var(--text-300)' }}>
            Your details (Room, Matric, College) have been submitted to our admin team. 
            Verification is manual to maintain campus integrity.
          </p>
          <div style={{ background: 'var(--bg-200)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid var(--primary)' }}>
            <p style={{ marginBottom: '1rem', fontWeight: 600, color: 'var(--primary)' }}>⚠️ MANDATORY NEXT STEP:</p>
            <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>Contact the Global Admin on WhatsApp to finalize your verification and unlock your store capabilities.</p>
            <a 
              href={`https://wa.me/${ADMIN_WHATSAPP}?text=Hi Admin, I just submitted my vendor application for "${form.brandName}". My Matric No is ${form.matricNo}. I'm ready to finalize my registration.`} 
              target="_blank" 
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', background: '#25D366', borderColor: '#25D366' }}
            >
              <MessageCircle size={20} /> MESSAGE ADMIN TO FINALIZE
            </a>
          </div>
          <Link href="/" className="btn btn-primary">Back to Hub</Link>
        </div>
      </div>
    );
  }

  return (
    <main className="container">
      <div className={styles.page}>
        <div className={styles.header}>
          <h1>Become an ABUAD Brand Owner</h1>
          <p>Launch your store vividly. No upfront fees — get 5 free credits to start.</p>
        </div>

        {errorMsg && (
          <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', marginBottom: '1.5rem', textAlign: 'center' }}>
            {errorMsg}
          </div>
        )}

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

        <div className={`card ${styles.card}`}>
          {step === 1 && (
            <div className={styles.stepContent}>
              <h2 className={styles.stepTitle}>Choose your account type</h2>
              <div className={styles.typeGrid}>
                {['Product Seller', 'Service Provider', 'Both'].map((label, i) => (
                  <button
                    key={label}
                    className={`${styles.typeCard} ${vendorType === label ? styles.typeSelected : ''}`}
                    onClick={() => setVendorType(label)}
                  >
                    <span className={styles.typeEmoji}>{i === 0 ? '🛍️' : i === 1 ? '✨' : '🌟'}</span>
                    <h3>{label}</h3>
                    {vendorType === label && <div className={styles.typeCheck}><CheckCircle size={18} /></div>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className={styles.stepContent}>
              <h2 className={styles.stepTitle}>Brand Details</h2>
              <div className={styles.formGrid}>
                <div className="form-group">
                  <label className="form-label">Store / Brand Name *</label>
                  <input className="form-input" placeholder="e.g. Trendy Collections" value={form.brandName} onChange={e => setForm({...form, brandName: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Brand Description *</label>
                  <textarea className="form-input" placeholder="What do you sell?" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">WhatsApp Contact *</label>
                  <input className="form-input" placeholder="+234..." value={form.whatsapp} onChange={e => setForm({...form, whatsapp: e.target.value})} />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className={styles.stepContent}>
              <h2 className={styles.stepTitle}>Academic Verification</h2>
              <p className={styles.stepDesc}>Details will be verified manually by the admin team.</p>
              <div className={styles.formGrid}>
                <div className="form-group">
                  <label className="form-label">Matric Number *</label>
                  <input className="form-input" placeholder="e.g. 21/ENG02/001" value={form.matricNo} onChange={e => setForm({...form, matricNo: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Room Number *</label>
                  <input className="form-input" placeholder="e.g. PG4, Room 102" value={form.roomNo} onChange={e => setForm({...form, roomNo: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">College *</label>
                  <input className="form-input" placeholder="e.g. Engineering" value={form.college} onChange={e => setForm({...form, college: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Department *</label>
                  <input className="form-input" placeholder="e.g. Electrical Engineering" value={form.department} onChange={e => setForm({...form, department: e.target.value})} />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className={styles.stepContent}>
              <h2 className={styles.stepTitle}>Ready to begin?</h2>
              <div className={styles.termsBox}>
                <p><strong>Matric Verification:</strong> Admin will verify your identity. False info leads to permanent ban.</p>
                <p><strong>Credit System:</strong> You get 5 free listing credits today.</p>
                <p><strong>Power Week:</strong> One week free of full vendor abilities. After that, credit rates apply.</p>
              </div>
              <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={handleSubmit} disabled={loading}>
                {loading ? 'Submitting...' : 'Complete Registration & Contact Admin'}
              </button>
            </div>
          )}

          <div className={styles.navButtons}>
            {step > 1 && <button className="btn btn-ghost" onClick={prev}><ArrowLeft size={16} /> Back</button>}
            {step < 4 && <button className="btn btn-primary" onClick={next} disabled={!vendorType && step === 1}>Continue <ArrowRight size={16} /></button>}
          </div>
        </div>
      </div>
    </main>
  );
}

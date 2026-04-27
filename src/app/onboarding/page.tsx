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
  Wallet,
  Building
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from './onboarding.module.css';

const STEPS = [
  { id: 1, label: 'Account Type', icon: <User size={20} /> },
  { id: 2, label: 'Brand Details', icon: <Store size={20} /> },
  { id: 3, label: 'Verification', icon: <GraduationCap size={20} /> },
  { id: 4, label: 'Bank Details', icon: <Wallet size={20} /> },
  { id: 5, label: 'Terms', icon: <ShieldCheck size={20} /> },
];

const ADMIN_WHATSAPP = "2348012345678"; // Replace with your actual number

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [vendorType, setVendorType] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [banks, setBanks] = useState<any[]>([]);
  const [verifyingBank, setVerifyingBank] = useState(false);

  const [form, setForm] = useState({
    brandName: '',
    description: '',
    category: 'Clothing',
    whatsapp: '',
    verificationType: 'academic',
    roomNo: '',
    matricNo: '',
    college: '',
    department: '',
    businessName: '',
    businessRegNo: '',
    businessAddress: '',
    bankName: '',
    bankCode: '',
    accountNumber: '',
    accountName: '',
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

    const fetchBanks = async () => {
      try {
        const res = await fetch('/api/paystack/banks');
        const data = await res.json();
        if (data.success) setBanks(data.data);
      } catch (err) {
        console.error('Failed to fetch banks');
      }
    };
    fetchBanks();
  }, [router]);

  // Auto-resolve bank name
  useEffect(() => {
    const resolveBank = async () => {
      if (form.accountNumber.length === 10 && form.bankCode) {
        setVerifyingBank(true);
        try {
          const res = await fetch(`/api/paystack/resolve?accountNumber=${form.accountNumber}&bankCode=${form.bankCode}`);
          const data = await res.json();
          if (data.success) {
            setForm(prev => ({ ...prev, accountName: data.data.account_name }));
          } else {
            setForm(prev => ({ ...prev, accountName: '' }));
          }
        } catch (err) {
          console.error('Bank resolution error');
        } finally {
          setVerifyingBank(false);
        }
      }
    };
    resolveBank();
  }, [form.accountNumber, form.bankCode]);

  const next = () => setStep((s) => Math.min(s + 1, 5));
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
          verification_type: form.verificationType,
          room_number: form.verificationType === 'academic' ? form.roomNo : null,
          matric_number: form.verificationType === 'academic' ? form.matricNo : null,
          college: form.verificationType === 'academic' ? form.college : null,
          department: form.verificationType === 'academic' ? form.department : null,
          business_name: form.verificationType === 'business' ? form.businessName : null,
          business_registration_number: form.verificationType === 'business' ? form.businessRegNo : null,
          business_address: form.verificationType === 'business' ? form.businessAddress : null,
          bank_name: form.bankName,
          bank_code: form.bankCode,
          bank_account_number: form.accountNumber,
          bank_account_name: form.accountName,
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
      
      // Auto-redirect removed because browsers block it silently as a popup.
      // We explicitly rely on the visible button in the UI for the user to tap.
      
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
              <h2 className={styles.stepTitle}>Identity Verification</h2>
              <p className={styles.stepDesc}>Choose how you want to verify your identity.</p>

              <div className={styles.typeGrid} style={{ marginBottom: '2rem' }}>
                <button
                  className={`${styles.typeCard} ${form.verificationType === 'academic' ? styles.typeSelected : ''}`}
                  onClick={() => setForm({...form, verificationType: 'academic'})}
                >
                  <span className={styles.typeEmoji}>🎓</span>
                  <h3>Student</h3>
                </button>
                <button
                  className={`${styles.typeCard} ${form.verificationType === 'business' ? styles.typeSelected : ''}`}
                  onClick={() => setForm({...form, verificationType: 'business'})}
                >
                  <span className={styles.typeEmoji}>🏢</span>
                  <h3>Registered Business</h3>
                </button>
              </div>

              {form.verificationType === 'academic' ? (
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
              ) : (
                <div className={styles.formGrid}>
                  <div className="form-group">
                    <label className="form-label">Business Name *</label>
                    <input className="form-input" placeholder="e.g. Trendy Collections LTD" value={form.businessName} onChange={e => setForm({...form, businessName: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Registration Number (CAC) *</label>
                    <input className="form-input" placeholder="e.g. RC 123456" value={form.businessRegNo} onChange={e => setForm({...form, businessRegNo: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Business Address *</label>
                    <input className="form-input" placeholder="Full physical address" value={form.businessAddress} onChange={e => setForm({...form, businessAddress: e.target.value})} />
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className={styles.stepContent}>
              <h2 className={styles.stepTitle}>Bank Details for Payouts</h2>
              <p className={styles.stepDesc}>Where should we send your earnings?</p>
              <div className={styles.formGrid}>
                 <div className="form-group">
                   <label className="form-label">Select Bank *</label>
                   <select 
                     className="form-input" 
                     value={form.bankCode} 
                     onChange={e => {
                       const bank = banks.find(b => b.code === e.target.value);
                       setForm({...form, bankCode: e.target.value, bankName: bank?.name || ''});
                     }}
                   >
                     <option value="">-- Choose Bank --</option>
                     {banks.map(b => (
                       <option key={b.code} value={b.code}>{b.name}</option>
                     ))}
                   </select>
                 </div>
                 <div className="form-group">
                   <label className="form-label">Account Number *</label>
                   <input className="form-input" placeholder="10-digit number" value={form.accountNumber} onChange={e => setForm({...form, accountNumber: e.target.value})} maxLength={10} />
                 </div>
                 <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                   <label className="form-label">
                     Account Name {verifyingBank && <span style={{ color: 'var(--primary)', fontSize: '0.75rem', marginLeft: '0.5rem' }}>(Verifying...)</span>}
                   </label>
                   <input 
                     className="form-input" 
                     placeholder={verifyingBank ? "Looking up..." : "Enter account number to fetch name"} 
                     value={form.accountName} 
                     readOnly 
                     style={{ background: 'var(--bg-200)', cursor: 'not-allowed', color: 'var(--primary)', fontWeight: 600 }}
                   />
                 </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className={styles.stepContent}>
              <h2 className={styles.stepTitle}>Terms & Conditions</h2>
              <p className={styles.stepDesc}>Please read carefully before completing your registration.</p>
              
              <div style={{ height: '300px', overflowY: 'auto', padding: '1.25rem', background: 'var(--bg-200)', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1.5rem', border: '1px solid var(--border)', lineHeight: '1.6' }}>
                <h4 style={{ marginBottom: '0.5rem', color: 'var(--text-100)' }}>1. Identity Verification</h4>
                <p style={{ marginBottom: '1rem', color: 'var(--text-300)' }}>All vendors must undergo manual identity verification. Submitting false academic (Matriculation/Room number) or business credentials will lead to an immediate and permanent ban from the ABUAD Fashion Hub platform.</p>
                
                <h4 style={{ marginBottom: '0.5rem', color: 'var(--text-100)' }}>2. Financial Escrow & Payouts</h4>
                <p style={{ marginBottom: '1rem', color: 'var(--text-300)' }}>To protect our customers, all funds from completed orders are held in a secure Escrow system for a mandatory 24-hour period post-delivery. Once the hold clears, you may request a manual payout to your registered bank account. Minimum withdrawal is ₦1,000.</p>
                
                <h4 style={{ marginBottom: '0.5rem', color: 'var(--text-100)' }}>3. Fees & Subscriptions (Subject to Change)</h4>
                <p style={{ marginBottom: '1rem', color: 'var(--text-300)' }}>The platform operates on a subscription and commission model. By proceeding, you agree to pay the current subscription rates required to keep your store active. <strong>Please note: All platform fees, commissions, and subscription prices are subject to change.</strong> However, you will be notified via in-app alerts and email prior to any pricing adjustments.</p>
                
                <h4 style={{ marginBottom: '0.5rem', color: 'var(--text-100)' }}>4. Free Trial & Credits</h4>
                <p style={{ marginBottom: '1rem', color: 'var(--text-300)' }}>New vendors receive a "Power Week" (7 days) of free full-access to platform features and 5 free product listing credits. Once exhausted, standard rates apply.</p>

                <h4 style={{ marginBottom: '0.5rem', color: 'var(--text-100)' }}>5. Vendor Conduct</h4>
                <p style={{ marginBottom: '1rem', color: 'var(--text-300)' }}>You agree to fulfill orders promptly, communicate respectfully with customers, and only list authentic items. The admin reserves the right to suspend or terminate any store violating platform integrity, selling prohibited items, or engaging in fraudulent behavior.</p>
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', marginBottom: '1.5rem', fontSize: '0.9rem', padding: '1rem', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <input 
                  type="checkbox" 
                  checked={acceptedTerms} 
                  onChange={(e) => setAcceptedTerms(e.target.checked)} 
                  style={{ marginTop: '0.2rem', minWidth: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                <span style={{ color: 'var(--text-200)', lineHeight: '1.5' }}>
                  I have read, understood, and accept the complete Terms & Conditions, and acknowledge that all platform fees are subject to change with prior notice.
                </span>
              </label>

              <button 
                className="btn btn-primary btn-lg" 
                style={{ width: '100%', opacity: (!acceptedTerms || loading) ? 0.5 : 1 }} 
                onClick={handleSubmit} 
                disabled={loading || !acceptedTerms}
              >
                {loading ? 'Submitting...' : 'Accept & Complete Registration'}
              </button>
            </div>
          )}

          <div className={styles.navButtons}>
            {step > 1 && <button className="btn btn-ghost" onClick={prev}><ArrowLeft size={16} /> Back</button>}
            {step < 5 && <button className="btn btn-primary" onClick={next} disabled={!vendorType && step === 1}>Continue <ArrowRight size={16} /></button>}
          </div>
        </div>
      </div>
    </main>
  );
}

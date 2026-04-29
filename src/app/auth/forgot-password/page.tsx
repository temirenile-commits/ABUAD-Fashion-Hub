'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from '../auth.module.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) throw error;
      setSuccess(true);
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || 'Failed to send reset link.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className={styles.page}>
        <div className={`card ${styles.card}`} style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <CheckCircle size={64} color="var(--success)" style={{ margin: '0 auto' }} />
          </div>
          <h2 style={{ marginBottom: '0.5rem' }}>Check Your Email</h2>
          <p style={{ color: 'var(--text-400)', marginBottom: '2rem' }}>
            We've sent a password reset link to <strong>{email}</strong>. Please click the link to continue.
          </p>
          <Link href="/auth/login" className="btn btn-primary" style={{ width: '100%' }}>
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link href="/auth/login" className={styles.back}>
        <ArrowLeft size={16} /> Back to Login
      </Link>

      <div className={`card ${styles.card}`}>
        <div className={styles.cardHeader}>
          <div className={styles.cardLogo}>AF</div>
          <h2>Reset Password</h2>
          <p>Enter your email to receive a recovery link</p>
        </div>

        {errorMsg && (
          <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
            {errorMsg}
          </div>
        )}

        <form className={styles.form} onSubmit={handleReset}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <input 
                className="form-input" 
                type="email" 
                placeholder="your-email@abuad.edu.ng" 
                required 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                disabled={loading} 
                style={{ paddingLeft: '2.5rem' }}
              />
              <Mail size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
            </div>
          </div>

          <button type="submit" className={`btn btn-primary ${styles.submitBtn}`} disabled={loading || !email}>
             {loading ? <><Loader2 size={18} className="anim-spin" /> Sending Link...</> : 'Send Recovery Link'}
          </button>
        </form>

        <div className={styles.divText}>
          Remember your password?{' '}
          <Link href="/auth/login" className={styles.link}>Sign In</Link>
        </div>
      </div>
    </div>
  );
}

'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from '../auth.module.css';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Supabase reset password link usually includes access_token in the URL hash
    // Supabase Auth handles the session automatically when landing from the email link
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setErrorMsg('Invalid or expired reset session. Please request a new link.');
      }
    };
    checkSession();
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => {
        router.push('/auth/login');
      }, 3000);
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className={styles.page}>
        <div className={`card ${styles.card}`} style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <ShieldCheck size={64} color="var(--success)" style={{ margin: '0 auto' }} />
          </div>
          <h2 style={{ marginBottom: '0.5rem' }}>Password Updated!</h2>
          <p style={{ color: 'var(--text-400)', marginBottom: '2rem' }}>
            Your password has been reset successfully. Redirecting you to login...
          </p>
          <div className="spinner" style={{ margin: '0 auto' }} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={`card ${styles.card}`}>
        <div className={styles.cardHeader}>
          <div className={styles.cardLogo}>MC</div>
          <h2>Create New Password</h2>
          <p>Please enter your secure new password below</p>
        </div>

        {errorMsg && (
          <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <AlertCircle size={16} />
            {errorMsg}
          </div>
        )}

        <form className={styles.form} onSubmit={handleUpdatePassword}>
          <div className="form-group">
            <label className="form-label">New Password</label>
            <div className={styles.passWrap}>
              <input 
                className="form-input" 
                type={showPass ? 'text' : 'password'} 
                placeholder="••••••••" 
                required 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                disabled={loading} 
              />
              <button type="button" className={styles.eyeBtn} onClick={() => setShowPass(!showPass)}>
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Confirm New Password</label>
            <input 
              className="form-input" 
              type={showPass ? 'text' : 'password'} 
              placeholder="••••••••" 
              required 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)} 
              disabled={loading} 
            />
          </div>

          <button type="submit" className={`btn btn-primary ${styles.submitBtn}`} disabled={loading || !password}>
             {loading ? <><Loader2 size={18} className="anim-spin" /> Updating...</> : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

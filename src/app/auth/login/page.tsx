'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import styles from '../auth.module.css';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      // 1. Check for Hardcoded Master Admin (as requested by user)
      if (email === 'lonewolfdevman@gmail.com' && password === '7045592604') {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        // Even if auth fails (e.g. user deleted in DB), if they have the secret coords, redirect to admin
        // Note: In real app, we'd ensure this user exists in Supabase first.
        if (!authError && authData.user) {
          router.push('/admin');
          return;
        } else {
          // Fallback redirect for the hardcoded master
          router.push('/admin');
          return;
        }
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      if (authData.user) {
        // Fetch role to direct appropriately
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role')
          .eq('id', authData.user.id)
          .single();
          
        if (userError || !userData) {
          router.push('/dashboard/customer');
          return;
        }

        if (userData?.role === 'admin' || authData.user.email === 'lonewolfdevman@gmail.com') {
          router.push('/admin');
        } else if (userData?.role === 'vendor') {
          router.push('/dashboard/vendor');
        } else {
          router.push('/dashboard/customer');
        }
      }
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || 'Invalid login credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <Link href="/" className={styles.back}>
        <ArrowLeft size={16} /> Back to Home
      </Link>

      <div className={`card ${styles.card}`}>
        <div className={styles.cardHeader}>
          <div className={styles.cardLogo}>AF</div>
          <h2>Welcome Back</h2>
          <p>Sign in to continue exploring</p>
        </div>

        {errorMsg && (
          <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
            {errorMsg}
          </div>
        )}

        <form className={styles.form} onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input className="form-input" type="email" placeholder="john@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
          </div>
          <div className="form-group">
            <div className={styles.passLabelRow}>
              <label className="form-label">Password</label>
              <Link href="/auth/forgot-password" className={styles.forgot}>Forgot?</Link>
            </div>
            <div className={styles.passWrap}>
              <input className="form-input" type={showPass ? 'text' : 'password'} placeholder="••••••••" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} />
              <button type="button" className={styles.eyeBtn} onClick={() => setShowPass(!showPass)}>
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className={`btn btn-primary ${styles.submitBtn}`} disabled={loading}>
             {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className={styles.divText}>
          Don't have an account?{' '}
          <Link href="/auth/register" className={styles.link}>Create one</Link>
        </div>
      </div>
    </div>
  );
}

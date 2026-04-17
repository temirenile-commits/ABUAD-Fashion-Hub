'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import styles from '../auth.module.css';
import { supabase } from '@/lib/supabase';

export default function RegisterPage() {
  const router = useRouter();
  const [showPass, setShowPass] = useState(false);
  const [role, setRole] = useState('customer');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      // 1. Register with Supabase Auth
      // We pass name and role in metadata (options.data) 
      // This allows a database trigger to handle profile creation automatically
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
            role: role
          }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        // SUCCESS: The database trigger (handle_new_user) will automatically
        // create the profile row in public.users. 
        
        // Give a small hint if email confirmation is likely on
        if (authData.session === null) {
          setErrorMsg('Success! Please check your email to confirm your account before logging in.');
          return;
        }

        // 3. Route according to role
        if (role === 'vendor') {
          router.push('/onboarding');
        } else {
          router.push('/dashboard/customer');
        }
      }
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || 'An error occurred during registration.');
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
          <h2>Create Account</h2>
          <p>Join the #1 campus fashion community</p>
        </div>

        {errorMsg && (
          <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
            {errorMsg}
          </div>
        )}

        {/* Role Toggle */}
        <div className={styles.roleToggle}>
          <button
            type="button"
            className={`${styles.roleBtn} ${role === 'customer' ? styles.roleActive : ''}`}
            onClick={() => setRole('customer')}
          >
            🛍️ Student / Customer
          </button>
          <button
            type="button"
            className={`${styles.roleBtn} ${role === 'vendor' ? styles.roleActive : ''}`}
            onClick={() => setRole('vendor')}
          >
            🏪 Brand / Vendor
          </button>
        </div>

        <form className={styles.form} onSubmit={handleRegister}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" type="text" placeholder="John Doe" required value={name} onChange={(e) => setName(e.target.value)} disabled={loading} />
          </div>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input className="form-input" type="email" placeholder="john@abuad.edu.ng" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <div className={styles.passWrap}>
              <input className="form-input" type={showPass ? 'text' : 'password'} placeholder="••••••••" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} />
              <button type="button" className={styles.eyeBtn} onClick={() => setShowPass(!showPass)}>
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className={`btn btn-primary ${styles.submitBtn}`} disabled={loading}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className={styles.divText}>
          Already have an account?{' '}
          <Link href="/auth/login" className={styles.link}>Login</Link>
        </div>
      </div>
    </div>
  );
}

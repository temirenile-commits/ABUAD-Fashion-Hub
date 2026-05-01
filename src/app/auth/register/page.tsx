'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
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
  const [universities, setUniversities] = useState<any[]>([]);
  const [universityId, setUniversityId] = useState('');

  useEffect(() => {
    supabase.from('universities').select('id, name').eq('is_active', true).then(({ data }) => {
      if (data) setUniversities(data);
    });
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    // Password validation
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSymbols = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const isLongEnough = password.length >= 6;

    if (!isLongEnough || !hasUpperCase || !hasLowerCase || !hasNumbers || !hasSymbols) {
      setErrorMsg('Password must be at least 6 characters and include uppercase, lowercase, numbers, and symbols.');
      setLoading(false);
      return;
    }

    if (role === 'customer' && !universityId) {
      setErrorMsg('Please select your university.');
      setLoading(false);
      return;
    }

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
        // Reliably create/update profile in public.users regardless of DB trigger
        // Using upsert so it's safe to re-run if a trigger already handled it
        await supabase.from('users').upsert({
          id: authData.user.id,
          email: email,
          name: name,
          role: role,
          phone: null,
          university_id: universityId || null,
        }, { onConflict: 'id' });

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
            <input className="form-input" type="email" placeholder="john@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
          </div>
          <div className="form-group">
            <label className="form-label">{role === 'vendor' ? 'University Base (Optional for General Vendors)' : 'Your University'}</label>
            <select className="form-input" value={universityId} onChange={(e) => setUniversityId(e.target.value)} required={role === 'customer'} disabled={loading}>
              <option value="">{role === 'vendor' ? '-- Select Campus or leave blank for General --' : 'Select your university...'}</option>
              {role === 'vendor' && <option value="">🌍 General / Multi-Campus Vendor</option>}
              {universities.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <div className={styles.passWrap}>
              <input className="form-input" type={showPass ? 'text' : 'password'} placeholder="••••••••" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} />
              <button type="button" className={styles.eyeBtn} onClick={() => setShowPass(!showPass)}>
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className={styles.subText} style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: 'var(--text-muted)' }}>
              Mix of uppercase, lowercase, numbers & symbols (min 6 chars)
            </p>
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

'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import styles from '../auth.module.css';

export default function RegisterPage() {
  const [showPass, setShowPass] = useState(false);
  const [role, setRole] = useState('customer');

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

        {/* Role Toggle */}
        <div className={styles.roleToggle}>
          <button
            className={`${styles.roleBtn} ${role === 'customer' ? styles.roleActive : ''}`}
            onClick={() => setRole('customer')}
          >
            🛍️ Student / Customer
          </button>
          <button
            className={`${styles.roleBtn} ${role === 'vendor' ? styles.roleActive : ''}`}
            onClick={() => setRole('vendor')}
          >
            🏪 Brand / Vendor
          </button>
        </div>

        <form className={styles.form}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" type="text" placeholder="John Doe" required />
          </div>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input className="form-input" type="email" placeholder="john@abuad.edu.ng" required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <div className={styles.passWrap}>
              <input className="form-input" type={showPass ? 'text' : 'password'} placeholder="••••••••" required />
              <button type="button" className={styles.eyeBtn} onClick={() => setShowPass(!showPass)}>
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" className={`btn btn-primary ${styles.submitBtn}`}>
            Create Account
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

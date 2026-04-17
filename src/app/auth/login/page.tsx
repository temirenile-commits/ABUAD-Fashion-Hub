'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import styles from '../auth.module.css';

export default function LoginPage() {
  const [showPass, setShowPass] = useState(false);

  return (
    <div className={styles.page}>
      <Link href="/" className={styles.back}>
        <ArrowLeft size={16} /> Back to Home
      </Link>

      <div className={`card ${styles.card}`}>
        <div className={styles.cardHeader}>
          <div className={styles.cardLogo}>AF</div>
          <h2>Welcome Back</h2>
          <p>Sign in to your ABUAD Fashion Hub account</p>
        </div>

        <form className={styles.form}>
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
          <div className={styles.forgotRow}>
            <Link href="/auth/forgot-password" className={styles.link}>Forgot Password?</Link>
          </div>

          <button type="submit" className={`btn btn-primary ${styles.submitBtn}`}>
            Sign In
          </button>
        </form>

        <div className={styles.divText}>
          Don&apos;t have an account?{' '}
          <Link href="/auth/register" className={styles.link}>Sign up free</Link>
        </div>
      </div>
    </div>
  );
}

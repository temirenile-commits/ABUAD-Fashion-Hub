'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Phone,
  MapPin,
  Lock,
  Trash2,
  Save,
  AlertTriangle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from './settings.module.css';
import MilesSettingsPanel from '@/components/MilesSettingsPanel';
import UniversityMarketplaceSwitcher from '@/components/UniversityMarketplaceSwitcher';

/** Simple inline toast for confirmations */
function Toast({ message, kind }: { message: string; kind: 'success' | 'error' }) {
  return <div className={`${styles.toast} ${styles[kind]}`}>{message}</div>;
}

export default function SettingsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<{ id: string; email?: string; role?: string } | null>(null);

  // Saved checkout info
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);

  // Password reset
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const pwStrength = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  }, [password]); // 0..4
  const [savingPw, setSavingPw] = useState(false);

  // Danger zone
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null);
  const showToast = (message: string, kind: 'success' | 'error') => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/auth/login?next=/settings');
        return;
      }
      setUser(user);
      const { data: profile } = await supabase
        .from('users')
        .select('phone, default_address, role')
        .eq('id', user.id)
        .single();
      if (profile) {
        setPhone(profile.phone || '');
        setAddress(profile.default_address || '');
        setUser((current) => current ? { ...current, role: profile.role } : current);
      }
      setReady(true);
    })();
  }, [router]);

  const handleSaveCheckoutInfo = async () => {
    if (!user) return;
    setSavingInfo(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ phone: phone.trim(), default_address: address.trim() })
        .eq('id', user.id);
      if (error) throw error;
      showToast('Checkout information saved!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save.', 'error');
    } finally {
      setSavingInfo(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user) return;
    if (pwStrength < 3) {
      showToast('Please choose a stronger password (8+ chars, mixed case, numbers).', 'error');
      return;
    }
    setSavingPw(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword('');
      showToast('Password updated successfully!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update password.', 'error');
    } finally {
      setSavingPw(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || confirmText.trim().toUpperCase() !== 'DELETE') return;
    setDeleting(true);
    try {
      const res = await fetch('/api/account', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete account.');
      }
      await supabase.auth.signOut();
      router.push('/');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete account.', 'error');
      setDeleting(false);
    }
  };

  if (!ready || !user) {
    return (
      <div className={styles.page}>
        <div className={styles.wrap} style={{ paddingTop: '6rem', textAlign: 'center', color: 'var(--text-400)' }}>
          Loading settings...
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.wrap}>
        <div className={styles.header}>
          <Link href="/dashboard/customer" className={styles.backLink}>
            <ArrowLeft size={16} /> Back
          </Link>
        </div>
        <h1 className={styles.title}>Account Settings</h1>
        <p className={styles.sub}>{user.email}</p>

        <MilesSettingsPanel />
        {['customer', 'user'].includes(user.role || '') && <UniversityMarketplaceSwitcher />}

        {/* ── Saved Checkout Information ─────────────────────────── */}
        <div className={styles.section} style={{ marginTop: '1.5rem' }}>
          <h2 className={styles.sectionTitle}>
            <MapPin size={18} style={{ color: 'var(--primary)' }} />
            Saved Checkout Information
          </h2>
          <p className={styles.sectionDesc}>
            These details are used to auto-fill the checkout page. Phone and address are stored on your profile.
          </p>
          <div className={styles.formRow}>
            <label>Phone Number</label>
            <input
              className={styles.input}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 0801 234 5678"
            />
          </div>
          <div className={styles.formRow}>
            <label>Default Address / Location</label>
            <input
              className={styles.input}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. University Hall, Block A, Room 12"
            />
          </div>
          <div className={styles.saveRow}>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSaveCheckoutInfo}
              disabled={savingInfo}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Save size={14} />
              {savingInfo ? 'Saving...' : 'Save Information'}
            </button>
          </div>
        </div>

        {/* ── Change Password ────────────────────────────────────── */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <Lock size={18} style={{ color: 'var(--primary)' }} />
            Change Password
          </h2>
          <p className={styles.sectionDesc}>
            Update your account password. You will stay signed in on your current device.
          </p>
          <div className={styles.formRow} style={{ position: 'relative' }}>
            <label>New Password</label>
            <input
              className={styles.input}
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter a strong new password"
              style={{ paddingRight: '2.6rem' }}
            />
            <button
              type="button"
              aria-label="Toggle password visibility"
              onClick={() => setShowPw((v) => !v)}
              style={{
                position: 'absolute',
                right: '0.6rem',
                top: '50%',
                transform: 'translateY(35%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-400)',
                cursor: 'pointer',
              }}
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            {password && (
              <div className={styles.strength} aria-label={`Password strength ${pwStrength} of 4`}>
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={styles.strengthBar}
                    style={{
                      background:
                        i <= pwStrength
                          ? pwStrength <= 1
                            ? '#FFFFFF'
                            : pwStrength <= 2
                              ? '#FFFFFF'
                              : '#FFFFFF'
                          : 'var(--bg-400)',
                    }}
                  />
                ))}
              </div>
            )}
          </div>
          <div className={styles.saveRow}>
            <button
              className="btn btn-primary btn-sm"
              onClick={handlePasswordReset}
              disabled={savingPw || !password}
            >
              {savingPw ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </div>

        {/* ── Danger Zone: Delete Account ────────────────────────── */}
        <div className={`${styles.section} ${styles.danger}`}>
          <h2 className={`${styles.sectionTitle} ${styles.dangerTitle}`}>
            <AlertTriangle size={18} />
            Danger Zone
          </h2>
          <p className={styles.dangerText}>
            Deleting your account is permanent and cannot be undone. Your profile, saved
            information, and messages will be removed. Past orders will be anonymized for
            business record keeping.
          </p>
          <button
            className="btn btn-sm"
            style={{
              background: 'linear-gradient(135deg, #000000, #FFFFFF)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
            onClick={() => setShowDeleteModal(true)}
          >
            <Trash2 size={14} />
            Delete Account
          </button>
        </div>
      </div>

      {/* ── Delete confirmation modal ────────────────────────────── */}
      {showDeleteModal && (
        <div className={styles.backdrop} onClick={() => !deleting && setShowDeleteModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Delete Your Account</h3>
            <p>
              This will permanently remove your account from MasterCart. To confirm, type{' '}
              <strong>DELETE</strong> below.
            </p>
            <input
              className={styles.input}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE to confirm"
              autoComplete="off"
            />
            <div className={styles.modalActions}>
              <button
                className="btn btn-sm"
                style={{ background: 'var(--bg-300)', color: 'var(--text-100)', border: '1px solid var(--border)' }}
                onClick={() => {
                  setShowDeleteModal(false);
                  setConfirmText('');
                }}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="btn btn-sm"
                style={{ background: 'linear-gradient(135deg, #000000, #FFFFFF)', color: '#FFFFFF' }}
                onClick={handleDeleteAccount}
                disabled={deleting || confirmText.trim().toUpperCase() !== 'DELETE'}
              >
                {deleting ? 'Deleting...' : 'Permanently Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} kind={toast.kind} />}
    </div>
  );
}

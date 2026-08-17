'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Copy, Link2, Network, Share2, WalletCards } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/lib/utils';
import styles from './referrals.module.css';

type ReferralData = {
  config: Record<string, any>;
  links: Array<{ id: string; referral_type: string; code: string; click_count: number; registration_count: number; activated_count: number; qualified_count: number }>;
  relationships: Array<{ id: string; referral_type: string; status: string; depth: number; created_at: string; referred?: { name?: string; email?: string } | null; referrer?: { name?: string; email?: string } | null }>;
  ledger: Array<{ id: string; source_type: string; amount: number; status: string; description: string; created_at: string }>;
  events: Array<{ id: string; event_type: string; created_at: string }>;
  summary: { total_earned: number; pending_earnings: number; available_earnings: number; withdrawn_earnings: number; reversed_earnings: number };
};

function referralUrl(code: string) {
  if (typeof window === 'undefined') return `/ref/${code}`;
  return `${window.location.origin}/ref/${code}`;
}

export default function CustomerReferralsPage() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [withdrawMessage, setWithdrawMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setError('Please sign in to view your referral activity.');
      setLoading(false);
      return;
    }
    const response = await fetch('/api/referrals', { cache: 'no-store', headers: { Authorization: `Bearer ${sessionData.session.access_token}` } });
    const payload = await response.json();
    if (!response.ok) setError(payload.error || 'Unable to load referral information.');
    else setData(payload);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const paused = data && !data.config.global_enabled;
  const customerLink = data?.links.find(link => link.referral_type === 'user_to_user');
  const vendorLink = data?.links.find(link => link.referral_type === 'user_to_vendor');
  const directReferrals = useMemo(() => (data?.relationships || []).filter(row => row.referral_type === 'user_to_user'), [data]);

  const createLink = async (referralType: 'user_to_user' | 'user_to_vendor') => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return;
    const response = await fetch('/api/referrals', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session.access_token}` },
      body: JSON.stringify({ action: 'link', referralType }),
    });
    if (!response.ok) setError((await response.json()).error || 'Referral rewards are temporarily paused.');
    else await load();
  };

  const copy = async (code: string) => {
    const url = referralUrl(code);
    await navigator.clipboard?.writeText(url);
    setCopied(code);
    setTimeout(() => setCopied(''), 1600);
  };

  const share = async (code: string) => {
    const url = referralUrl(code);
    if (navigator.share) await navigator.share({ title: 'Join me on MasterCart', text: 'Join me on MasterCart through my referral link.', url });
    else await copy(code);
  };

  const withdraw = async (event: React.FormEvent) => {
    event.preventDefault();
    setWithdrawMessage('');
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return setWithdrawMessage('Please sign in again before requesting a withdrawal.');
    const response = await fetch('/api/referrals', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session.access_token}` },
      body: JSON.stringify({ action: 'withdraw', amount: Number(withdrawAmount), bankDetails: { bankName, accountName, accountNumber } }),
    });
    const payload = await response.json();
    setWithdrawMessage(response.ok ? 'Withdrawal submitted for review.' : payload.error || 'Referral withdrawals are temporarily unavailable.');
    if (response.ok) { setWithdrawAmount(''); await load(); }
  };

  if (loading) return <div className={styles.loading}>Loading your referral activity…</div>;

  return (
    <main className={styles.page}>
      <div className={styles.topbar}><Link href="/dashboard/customer" className={styles.back}><ArrowLeft size={17} /> Dashboard</Link><h1>Referral Rewards</h1><span /></div>
      {error && <div className={styles.error}>{error}</div>}
      {paused && <div className={styles.paused}>Referral rewards are temporarily paused. Your existing referral activity and eligible earnings remain recorded. Please check back soon for updates.</div>}
      <section className={styles.hero}><div><p className={styles.eyebrow}>MasterCart referrals</p><h2>Share, grow, and earn from eligible activity.</h2><p>Your referral network is preserved and all earnings are calculated from verified MasterCart records.</p></div><Network size={52} aria-hidden="true" /></section>
      <section className={styles.stats}>
        {[['Total earned', data?.summary.total_earned], ['Available', data?.summary.available_earnings], ['Pending', data?.summary.pending_earnings], ['Withdrawn', data?.summary.withdrawn_earnings]].map(([label, value]) => <div className={styles.stat} key={label as string}><span>{label}</span><strong>{formatPrice(Number(value || 0))}</strong></div>)}
      </section>
      <section className={styles.grid}>
        <div className={styles.card}><div className={styles.cardTitle}><Link2 size={18} /><h3>Your referral links</h3></div><p className={styles.muted}>Clicks are tracked separately from registration, activation, qualification, and earnings.</p>
          {!customerLink ? <button className="btn btn-primary" disabled={Boolean(paused)} onClick={() => createLink('user_to_user')}>Generate customer link</button> : <LinkRow label="Customer referrals" link={customerLink} copied={copied} onCopy={copy} onShare={share} />}
          {!vendorLink ? <button className="btn btn-secondary" disabled={Boolean(paused)} onClick={() => createLink('user_to_vendor')}>Generate vendor link</button> : <LinkRow label="Vendor referrals" link={vendorLink} copied={copied} onCopy={copy} onShare={share} />}
        </div>
        <div className={styles.card}><div className={styles.cardTitle}><WalletCards size={18} /><h3>Cash out eligible earnings</h3></div><p className={styles.muted}>Withdrawals use the existing MasterCart payout review flow. Minimum: {formatPrice(Number(data?.config.minimum_withdrawal || 0))}.</p>
          <form className={styles.form} onSubmit={withdraw}><input className="form-input" type="number" min="1" placeholder="Amount" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} required /><input className="form-input" placeholder="Bank name" value={bankName} onChange={e => setBankName(e.target.value)} required /><input className="form-input" placeholder="Account name" value={accountName} onChange={e => setAccountName(e.target.value)} required /><input className="form-input" inputMode="numeric" placeholder="Account number" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} required /><button className="btn btn-primary" disabled={!data || Number(data.summary.available_earnings) <= 0}>Request withdrawal</button></form>{withdrawMessage && <p className={styles.message}>{withdrawMessage}</p>}
        </div>
      </section>
      <section className={styles.grid}>
        <div className={styles.card}><div className={styles.cardTitle}><Network size={18} /><h3>Referral network</h3></div>{directReferrals.length === 0 ? <div className={styles.empty}><strong>No referrals yet.</strong><span>Share your referral link to start earning.</span></div> : <div className={styles.list}>{directReferrals.map(row => <div className={styles.row} key={row.id}><div><strong>{row.referred?.name || row.referred?.email || 'MasterCart member'}</strong><span>Level {row.depth + 1} · {row.status}</span></div><time>{new Date(row.created_at).toLocaleDateString()}</time></div>)}</div>}</div>
        <div className={styles.card}><div className={styles.cardTitle}><h3>Recent referral activity</h3></div>{!data?.ledger.length ? <div className={styles.empty}><strong>No referral earnings yet.</strong><span>Your referral earnings will appear here once a referred user or vendor creates qualifying activity.</span></div> : <div className={styles.list}>{data.ledger.slice(0, 8).map(row => <div className={styles.row} key={row.id}><div><strong>{row.description}</strong><span>{row.status}</span></div><strong className={Number(row.amount) < 0 ? styles.negative : styles.positive}>{formatPrice(Math.abs(Number(row.amount)))}</strong></div>)}</div>}</div>
      </section>
    </main>
  );
}

function LinkRow({ label, link, copied, onCopy, onShare }: any) {
  return <div className={styles.linkRow}><div><strong>{label}</strong><code>/ref/{link.code}</code><span>{link.click_count} clicks · {link.activated_count} activated</span></div><div className={styles.linkActions}><button aria-label={`Copy ${label} link`} onClick={() => onCopy(link.code)}>{copied === link.code ? <Check size={16} /> : <Copy size={16} />}</button><button aria-label={`Share ${label} link`} onClick={() => onShare(link.code)}><Share2 size={16} /></button></div></div>;
}

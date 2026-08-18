'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Copy, Link2, MessageCircle, Network, Share2, Send, WalletCards } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatPrice } from '@/lib/utils';
import { getReferralMessage, getReferralShareTitle } from '@/lib/referral-messages';
import styles from './referrals.module.css';

type ReferralData = {
  config: Record<string, any>;
  links: Array<{ id: string; referral_type: string; code: string; click_count: number; registration_count: number; activated_count: number; qualified_count: number }>;
  relationships: Array<{ id: string; referral_type: string; status: string; earning_status?: string; qualifying_transaction_count?: number; qualifying_transaction_limit?: number | null; depth: number; created_at: string; referred?: { name?: string; email?: string } | null; referrer?: { name?: string; email?: string } | null }>;
  ledger: Array<{ id: string; source_type: string; amount: number; status: string; description: string; created_at: string }>;
  events: Array<{ id: string; event_type: string; created_at: string }>;
  summary: { total_earned: number; pending_earnings: number; available_earnings: number; withdrawn_earnings: number; reversed_earnings: number };
  referrerName?: string | null;
  payoutAccount?: { id: string; bank_name: string; masked_account_number: string; verified_account_name: string; verification_status: string; verified_at: string } | null;
  payoutHistory?: Array<{ id: string; amount_requested: number; status: string; created_at: string; confirmed_at?: string | null; transfer_reference?: string | null }>;
};

type BankOption = { name: string; code: string };
type PendingPayoutAccount = { bankCode: string; bankName: string; accountNumber: string; maskedAccountNumber: string; accountName: string; verificationReference?: string | null };

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
  const [withdrawMessage, setWithdrawMessage] = useState('');
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [bankStatus, setBankStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [bankError, setBankError] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [accountNumberDraft, setAccountNumberDraft] = useState('');
  const [pendingPayoutAccount, setPendingPayoutAccount] = useState<PendingPayoutAccount | null>(null);
  const [accountMessage, setAccountMessage] = useState('');
  const [verifyingAccount, setVerifyingAccount] = useState(false);
  const [confirmingAccount, setConfirmingAccount] = useState(false);

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

  const loadBanks = useCallback(async () => {
    setBankStatus('loading');
    setBankError('');
    try {
      const response = await fetch('/api/referrals?action=banks', { cache: 'no-store' });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Unable to load banks. Please try again.');
      const providerBanks = Array.isArray(payload.banks) ? payload.banks.filter((bank: BankOption) => bank?.name && bank?.code) : [];
      setBanks(providerBanks);
      setBankStatus('ready');
      if (!providerBanks.length) setBankError('No banks available.');
    } catch (error) {
      console.error('[REFERRAL_BANK_LIST_CLIENT]', error);
      setBanks([]);
      setBankStatus('error');
      setBankError('Unable to load banks. Please try again.');
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    const bankTimer = window.setTimeout(() => { void loadBanks(); }, 0);
    return () => { window.clearTimeout(timer); window.clearTimeout(bankTimer); };
  }, [load, loadBanks]);

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

  const copyLink = async (code: string) => {
    const url = referralUrl(code);
    await navigator.clipboard?.writeText(url);
    setCopied(`link:${code}`);
    setTimeout(() => setCopied(''), 1600);
  };

  const copyMessage = async (link: ReferralData['links'][number]) => {
    const url = referralUrl(link.code);
    const audience = link.referral_type === 'user_to_vendor' ? 'user_to_vendor' : 'user_to_user';
    await navigator.clipboard?.writeText(getReferralMessage(url, audience, data?.referrerName));
    setCopied(`message:${link.code}`);
    setTimeout(() => setCopied(''), 1600);
  };

  const share = async (link: ReferralData['links'][number]) => {
    const url = referralUrl(link.code);
    const audience = link.referral_type === 'user_to_vendor' ? 'user_to_vendor' : 'user_to_user';
    const text = getReferralMessage(url, audience, data?.referrerName, true, false);
    if (navigator.share) {
      try { await navigator.share({ title: getReferralShareTitle(), text, url }); } catch (error) { if ((error as Error).name !== 'AbortError') setError('Unable to open the share sheet.'); }
    } else {
      await copyMessage(link);
    }
  };

  const openPlatformShare = async (link: ReferralData['links'][number], platform: 'whatsapp' | 'telegram') => {
    const url = referralUrl(link.code);
    const audience = link.referral_type === 'user_to_vendor' ? 'user_to_vendor' : 'user_to_user';
    const text = getReferralMessage(url, audience, data?.referrerName, true, platform === 'whatsapp');
    const target = platform === 'whatsapp' ? `https://wa.me/?text=${encodeURIComponent(text)}` : `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(getReferralMessage(url, audience, data?.referrerName, true, false))}`;
    window.open(target, '_blank', 'noopener,noreferrer');
  };

  const verifyPayoutAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setAccountMessage('');
    const selectedBank = banks.find(bank => bank.code === bankCode);
    if (bankStatus !== 'ready' || !selectedBank || !/^\d{10,12}$/.test(accountNumberDraft.replace(/\D/g, ''))) return setAccountMessage('Enter a valid account number and select your bank.');
    setVerifyingAccount(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { setAccountMessage('Please sign in again before verifying your payout account.'); setVerifyingAccount(false); return; }
    const response = await fetch('/api/referrals', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session.access_token}` }, body: JSON.stringify({ action: 'verify_payout_account', accountNumber: accountNumberDraft, bankCode, bankName: selectedBank.name }) });
    const payload = await response.json();
    setAccountMessage(response.ok ? 'Account resolved. Confirm that the displayed name is yours.' : payload.error || 'Bank account verification failed.');
    if (response.ok) setPendingPayoutAccount(payload.account);
    setVerifyingAccount(false);
  };

  const confirmPayoutAccount = async () => {
    if (!pendingPayoutAccount) return;
    setConfirmingAccount(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { setAccountMessage('Please sign in again before confirming your payout account.'); setConfirmingAccount(false); return; }
    const response = await fetch('/api/referrals', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session.access_token}` }, body: JSON.stringify({ action: 'confirm_payout_account', account: pendingPayoutAccount }) });
    const payload = await response.json();
    setAccountMessage(response.ok ? 'Referral payouts will be sent to this account.' : payload.error || 'Payout account confirmation failed.');
    if (response.ok) { setPendingPayoutAccount(null); setBankCode(''); setAccountNumberDraft(''); await load(); }
    setConfirmingAccount(false);
  };

  const withdraw = async (event: React.FormEvent) => {
    event.preventDefault();
    setWithdrawMessage('');
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return setWithdrawMessage('Please sign in again before requesting a withdrawal.');
    const response = await fetch('/api/referrals', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session.access_token}` },
      body: JSON.stringify({ action: 'withdraw', amount: Number(withdrawAmount), payoutAccountId: data?.payoutAccount?.id }),
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
          {!customerLink ? <button className="btn btn-primary" disabled={Boolean(paused)} onClick={() => createLink('user_to_user')}>Generate customer link</button> : <LinkRow label="Customer referrals" link={customerLink} copied={copied} onCopy={copyLink} onCopyMessage={copyMessage} onShare={share} onPlatformShare={openPlatformShare} />}
          {!vendorLink ? <button className="btn btn-secondary" disabled={Boolean(paused)} onClick={() => createLink('user_to_vendor')}>Generate vendor link</button> : <LinkRow label="Vendor referrals" link={vendorLink} copied={copied} onCopy={copyLink} onCopyMessage={copyMessage} onShare={share} onPlatformShare={openPlatformShare} />}
        </div>
        <div className={styles.card}><div className={styles.cardTitle}><WalletCards size={18} /><h3>Payout account and cash out</h3></div><p className={styles.muted}>Referral payouts use a verified bank account. Minimum withdrawal: {formatPrice(Number(data?.config.minimum_withdrawal || 0))}.</p>
          {data?.payoutAccount ? <div className={styles.payoutAccount}><strong>{data.payoutAccount.bank_name}</strong><span>{data.payoutAccount.masked_account_number} · {data.payoutAccount.verified_account_name}</span><small>Verification: {data.payoutAccount.verification_status}</small><button className="btn btn-secondary" type="button" onClick={() => { setPendingPayoutAccount(null); setBankCode(''); setAccountNumberDraft(''); setAccountMessage('Enter a new account to replace the current payout account.'); }}>Change account</button></div> : (bankStatus === 'error' ? <div className={styles.bankState}><span>{bankError || 'Unable to load banks. Please try again.'}</span><button className="btn btn-secondary" type="button" onClick={() => void loadBanks()}>Retry</button></div> : bankStatus === 'ready' && banks.length === 0 ? <div className={styles.bankState}><span>No banks available.</span><button className="btn btn-secondary" type="button" onClick={() => void loadBanks()}>Retry</button></div> : <form className={styles.form} onSubmit={verifyPayoutAccount}><select className="form-input" value={bankCode} onChange={e => setBankCode(e.target.value)} required disabled={bankStatus !== 'ready'}><option value="">{bankStatus === 'loading' ? 'Loading banks…' : 'Select your bank'}</option>{banks.map(bank => <option key={bank.code} value={bank.code}>{bank.name}</option>)}</select><input className="form-input" inputMode="numeric" placeholder="Account number" value={accountNumberDraft} onChange={e => setAccountNumberDraft(e.target.value)} required disabled={bankStatus !== 'ready'} /><button className="btn btn-secondary" disabled={verifyingAccount || bankStatus !== 'ready' || !bankCode || !/^\d{10,12}$/.test(accountNumberDraft.replace(/\D/g, ''))}>{verifyingAccount ? 'Verifying…' : 'Verify bank account'}</button></form>)}
          {pendingPayoutAccount && <div className={styles.payoutAccount}><span>Bank: {pendingPayoutAccount.bankName}</span><span>Account: {pendingPayoutAccount.maskedAccountNumber}</span><strong>Account name: {pendingPayoutAccount.accountName}</strong><p>Is this your account?</p><button className="btn btn-primary" type="button" onClick={confirmPayoutAccount} disabled={confirmingAccount}>{confirmingAccount ? 'Attaching…' : 'Confirm Account'}</button></div>}
          {accountMessage && <p className={styles.message}>{accountMessage}</p>}
          {!data?.payoutAccount && Number(data?.summary.available_earnings || 0) > 0 && <p className={styles.muted}>Add and verify your bank account to receive referral payouts.</p>}
          <form className={`${styles.form} ${styles.withdrawForm}`} onSubmit={withdraw}><input className="form-input" type="number" min="1" placeholder="Amount" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} required /><button className="btn btn-primary" disabled={!data?.payoutAccount || Number(data.summary.available_earnings) <= 0}>Request withdrawal</button></form>{withdrawMessage && <p className={styles.message}>{withdrawMessage}</p>}
          {data?.payoutHistory?.length ? <div className={styles.list}>{data.payoutHistory.slice(0, 5).map(row => <div className={styles.row} key={row.id}><div><strong>{formatPrice(Number(row.amount_requested))}</strong><span>{row.status}</span></div><time>{new Date(row.created_at).toLocaleDateString()}</time></div>)}</div> : null}
        </div>
      </section>
      <section className={styles.grid}>
        <div className={styles.card}><div className={styles.cardTitle}><Network size={18} /><h3>Referral network</h3></div>{directReferrals.length === 0 ? <div className={styles.empty}><strong>No referrals yet.</strong><span>Share your referral link to start earning.</span></div> : <div className={styles.list}>{directReferrals.map(row => <div className={styles.row} key={row.id}><div><strong>{row.referred?.name || row.referred?.email || 'MasterCart member'}</strong><span>Level {row.depth + 1} · {row.status}{row.qualifying_transaction_limit ? ` · ${row.qualifying_transaction_count || 0} of ${row.qualifying_transaction_limit} qualifying ${row.referral_type === 'user_to_vendor' ? 'sales' : 'purchases'}` : ' · Unlimited qualifying activity'}</span>{row.earning_status === 'EXPIRED' && <small>Referral earning period completed.</small>}</div><time>{new Date(row.created_at).toLocaleDateString()}</time></div>)}</div>}</div>
        <div className={styles.card}><div className={styles.cardTitle}><h3>Recent referral activity</h3></div>{!data?.ledger.length ? <div className={styles.empty}><strong>No referral earnings yet.</strong><span>Your referral earnings will appear here once a referred user or vendor creates qualifying activity.</span></div> : <div className={styles.list}>{data.ledger.slice(0, 8).map(row => <div className={styles.row} key={row.id}><div><strong>{row.description}</strong><span>{row.status}</span></div><strong className={Number(row.amount) < 0 ? styles.negative : styles.positive}>{formatPrice(Math.abs(Number(row.amount)))}</strong></div>)}</div>}</div>
      </section>
    </main>
  );
}

function LinkRow({ label, link, copied, onCopy, onCopyMessage, onShare, onPlatformShare }: any) {
  return <div className={styles.linkRow}><div><strong>{label}</strong><code>/ref/{link.code}</code><span>{link.click_count} clicks · {link.registration_count} registered · {link.activated_count} activated</span></div><div className={styles.linkActions}><button aria-label={`Copy ${label} link`} onClick={() => onCopy(link.code)}>{copied === `link:${link.code}` ? <Check size={16} /> : <Copy size={16} />}</button><button aria-label={`Copy ${label} referral message`} onClick={() => onCopyMessage(link)}>{copied === `message:${link.code}` ? <Check size={16} /> : <MessageCircle size={16} />}</button><button aria-label={`Share ${label} link`} onClick={() => onShare(link)}><Share2 size={16} /></button><button aria-label={`Share ${label} on WhatsApp`} onClick={() => onPlatformShare(link, 'whatsapp')}><MessageCircle size={16} /></button><button aria-label={`Share ${label} on Telegram`} onClick={() => onPlatformShare(link, 'telegram')}><Send size={16} /></button></div></div>;
}

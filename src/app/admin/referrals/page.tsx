'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Link2, Network, Save, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from './referrals.module.css';

type AdminData = { config: Record<string, any>; stats: Record<string, number>; links: any[]; relationships: any[]; payouts: any[] };

const numericFields = [
  ['user_to_user_immediate_reward_amount', 'Immediate reward amount'],
  ['user_to_user_purchase_reward_percentage', 'User purchase reward %'],
  ['user_to_vendor_reward_percentage', 'Vendor sales reward %'],
  ['minimum_withdrawal', 'Minimum withdrawal'],
  ['maximum_withdrawal', 'Maximum withdrawal'],
  ['daily_withdrawal_limit', 'Daily withdrawal cap'],
  ['weekly_withdrawal_limit', 'Weekly withdrawal cap'],
  ['monthly_withdrawal_limit', 'Monthly withdrawal cap'],
  ['reward_confirmation_period_days', 'Confirmation period (days)'],
] as const;

export default function AdminReferralPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [config, setConfig] = useState<Record<string, any>>({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { setMessage('Authentication required.'); setLoading(false); return; }
    const response = await fetch('/api/referrals?action=admin', { cache: 'no-store', headers: { Authorization: `Bearer ${sessionData.session.access_token}` } });
    const payload = await response.json();
    if (!response.ok) setMessage(payload.error || 'Unable to load referral administration.');
    else { setData(payload); setConfig(payload.config || {}); }
    setLoading(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const save = async () => {
    setSaving(true); setMessage('');
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { setMessage('Authentication required.'); setSaving(false); return; }
    const response = await fetch('/api/referrals', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session.access_token}` }, body: JSON.stringify({ action: 'settings', config }) });
    const payload = await response.json();
    setMessage(response.ok ? 'Referral settings saved and audited.' : payload.error || 'Settings could not be saved.');
    if (response.ok) setConfig(payload.config);
    setSaving(false);
  };

  const processPayout = async (requestId: string, status: 'completed' | 'rejected') => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return setMessage('Authentication required.');
    const reference = status === 'completed' ? window.prompt('Enter the payout reference') : '';
    const response = await fetch('/api/referrals', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session.access_token}` }, body: JSON.stringify({ action: 'payout_process', requestId, status, reference }) });
    const payload = await response.json();
    setMessage(response.ok ? 'Referral payout updated.' : payload.error || 'Payout update failed.');
    if (response.ok) load();
  };

  const rootRelationships = useMemo(() => (data?.relationships || []).filter(row => !row.parent_referral_id), [data]);
  if (loading) return <div className={styles.loading}>Loading referral administration…</div>;

  return <main className={styles.page}>
    <div className={styles.topbar}><Link href="/admin" className={styles.back}><ArrowLeft size={17} /> Admin dashboard</Link><h1>Referral Management</h1><button className={styles.refresh} onClick={load}>Refresh</button></div>
    {message && <div className={styles.message}>{message}</div>}
    <section className={styles.toggleCard}><div><p className={styles.eyebrow}>Server-enforced controls</p><h2>Referral program controls</h2><p>Turning a program off pauses new attribution, activation, earning, and withdrawals while preserving historical relationships and ledger records.</p></div><div className={styles.toggles}>{[['global_enabled','Master referral system'],['user_to_user_enabled','User → User referrals'],['user_to_vendor_enabled','User → Vendor referrals'],['user_to_user_immediate_reward_enabled','Immediate signup reward'],['user_to_user_purchase_reward_enabled','User purchase reward'],['user_to_vendor_reward_enabled','Vendor sales reward']].map(([key,label]) => <label className={styles.toggle} key={key}><span>{label}</span><input type="checkbox" checked={Boolean(config[key])} onChange={e => setConfig(prev => ({ ...prev, [key]: e.target.checked }))} /></label>)}</div><button className="btn btn-primary" onClick={save} disabled={saving}><Save size={16} /> {saving ? 'Saving…' : 'Save controls'}</button></section>
    <section className={styles.stats}>{Object.entries({ 'Links': data?.stats.total_links, 'Clicks': data?.stats.total_clicks, 'Registered': data?.stats.registered_referrals, 'Active': data?.stats.active_referrals, 'Qualified': data?.stats.qualified_referrals, 'Total earned': data?.stats.total_earnings, 'Pending': data?.stats.pending_earnings, 'Withdrawn': data?.stats.withdrawn_earnings }).map(([label,value]) => <div className={styles.stat} key={label}><span>{label}</span><strong>{['Total earned','Pending','Withdrawn'].includes(label) ? `₦${Number(value || 0).toLocaleString()}` : Number(value || 0).toLocaleString()}</strong></div>)}</section>
    <section className={styles.card}><div className={styles.cardHeader}><div><p className={styles.eyebrow}>Validated configuration</p><h2>Earning and withdrawal rules</h2></div><button className="btn btn-primary" onClick={save} disabled={saving}><Save size={16} /> Save settings</button></div><div className={styles.formGrid}>{numericFields.map(([key,label]) => <label key={key}><span>{label}</span><input className="form-input" type="number" min="0" max={key.includes('percentage') ? '100' : undefined} value={config[key] ?? ''} onChange={e => setConfig(prev => ({ ...prev, [key]: e.target.value === '' ? null : Number(e.target.value) }))} /></label>)}</div></section>
    <section className={styles.card}><div className={styles.cardHeader}><div><p className={styles.eyebrow}>Funnel and network</p><h2>Active referral links</h2></div><Link2 size={23} /></div><div className={styles.tableWrap}><table><thead><tr><th>Code</th><th>Type</th><th>Clicks</th><th>Registered</th><th>Activated</th><th>Last activity</th></tr></thead><tbody>{(data?.links || []).map(row => <tr key={row.id}><td><code>{row.code}</code></td><td>{row.referral_type}</td><td>{row.click_count}</td><td>{row.registration_count}</td><td>{row.activated_count}</td><td>{row.last_activity_at ? new Date(row.last_activity_at).toLocaleString() : '—'}</td></tr>)}</tbody></table>{!data?.links?.length && <div className={styles.empty}>No referral links yet.</div>}</div></section>
    <section className={styles.card}><div className={styles.cardHeader}><div><p className={styles.eyebrow}>Lineage explorer</p><h2>Referral network</h2></div><Network size={23} /></div><div className={styles.tree}>{rootRelationships.length ? rootRelationships.map(root => <TreeNode key={root.id} row={root} all={data?.relationships || []} />) : <div className={styles.empty}>No referral network has been recorded yet.</div>}</div></section>
    <section className={styles.card}><div className={styles.cardHeader}><div><p className={styles.eyebrow}>Existing payout architecture</p><h2>Referral withdrawals</h2></div><ShieldCheck size={23} /></div><div className={styles.tableWrap}><table><thead><tr><th>User</th><th>Amount</th><th>Status</th><th>Requested</th><th>Action</th></tr></thead><tbody>{(data?.payouts || []).map(row => <tr key={row.id}><td>{row.user_id.slice(0,8)}…</td><td>₦{Number(row.amount_requested).toLocaleString()}</td><td>{row.status}</td><td>{new Date(row.created_at).toLocaleDateString()}</td><td>{['pending','processing'].includes(row.status) ? <span className={styles.actions}><button onClick={() => processPayout(row.id,'completed')}><CheckCircle2 size={15} /> Complete</button><button onClick={() => processPayout(row.id,'rejected')}>Reject</button></span> : '—'}</td></tr>)}</tbody></table>{!data?.payouts?.length && <div className={styles.empty}>No referral withdrawals yet.</div>}</div></section>
  </main>;
}

function TreeNode({ row, all }: { row: any; all: any[] }) {
  const children = all.filter(child => child.parent_referral_id === row.id);
  return <div className={styles.treeNode}><div><strong>{row.referrer?.name || row.referrer?.email || row.referrer_user_id.slice(0,8)}</strong><span> → {row.referred?.name || row.referred?.email || row.referred_user_id.slice(0,8)} · {row.referral_type} · depth {row.depth} · {row.status}</span></div>{children.length > 0 && <div className={styles.children}>{children.map(child => <TreeNode key={child.id} row={child} all={all} />)}</div>}</div>;
}

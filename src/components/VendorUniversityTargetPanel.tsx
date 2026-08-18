'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Loader2, MapPin, Send, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type University = { id: string; name: string; abbreviation?: string | null; location?: string | null };
type RequestRow = { id: string; status: string; reason: string; created_at: string; requested_university?: University | null; current_university?: University | null; admin_message?: string | null };

type Props = { brandId?: string | null; defaultOpen?: boolean };

export default function VendorUniversityTargetPanel({ brandId, defaultOpen = false }: Props) {
  const [brand, setBrand] = useState<any>(null);
  const [universities, setUniversities] = useState<University[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [selected, setSelected] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(defaultOpen);

  const load = async () => {
    setLoading(true);
    setMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/vendor/university-target', { headers: { Authorization: `Bearer ${session?.access_token || ''}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load target-university settings.');
      setBrand(data.brand);
      setUniversities(data.universities || []);
      setRequests(data.requests || []);
    } catch (error: any) {
      setMessage(error.message || 'Unable to load target-university settings.');
    } finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [brandId]);

  const pending = requests.find((request) => request.status === 'PENDING');
  const verified = Boolean(brand?.verified) && ['approved', 'verified'].includes(String(brand?.verification_status || '').toLowerCase());

  const submit = async () => {
    if (!selected) { setMessage('Select a university first.'); return; }
    if (reason.trim().length < 10) { setMessage('Please provide at least 10 characters explaining the change.'); return; }
    const requestedUniversity = universities.find((university) => university.id === selected);
    if (!window.confirm(`You're requesting to change the university marketplace your store targets to ${requestedUniversity?.name || 'the selected university'}.\n\nProducts in a university marketplace may be specifically sold and delivered within that university's region.\n\nPlease confirm that you understand this before continuing.`)) return;
    setSubmitting(true); setMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/vendor/university-target', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` }, body: JSON.stringify({ action: 'submit', requestedUniversityId: selected, reason: reason.trim() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Request could not be submitted.');
      setReason(''); setSelected(''); setMessage('Request submitted. Your current target remains unchanged until approval.'); await load();
    } catch (error: any) { setMessage(error.message || 'Request could not be submitted.'); }
    finally { setSubmitting(false); }
  };

  const cancel = async (requestId: string) => {
    if (!window.confirm('Cancel this pending university change request?')) return;
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/vendor/university-target', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` }, body: JSON.stringify({ action: 'cancel', requestId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Request could not be cancelled.');
      setMessage('Request cancelled.'); await load();
    } catch (error: any) { setMessage(error.message || 'Request could not be cancelled.'); }
    finally { setSubmitting(false); }
  };

  if (loading) return <section style={{ marginTop: '2rem', padding: '1.25rem', border: '1px solid var(--border)', borderRadius: 12 }}><Loader2 size={18} className="anim-spin" /> Loading target universities…</section>;

  const currentTarget = brand?.universities?.name || 'the general marketplace';
  const summary = <>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}><MapPin size={19} color="var(--primary)" /><h3 style={{ margin: 0 }}>Target University Marketplace</h3></div>
    <p style={{ color: 'var(--text-400)', fontSize: 13, marginTop: 0, marginBottom: 12 }}>Your store currently targets <strong>{currentTarget}</strong>. Products and reels published by your store use this target audience.</p>
    {!verified ? <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: '#fca5a5', fontSize: 13 }}><XCircle size={17} /><span>Target university changes are available only to verified vendors. Complete vendor verification before requesting a change.</span></div> : pending ? <div style={{ display: 'grid', gap: 10 }}><div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: '#fcd34d', fontSize: 13 }}><Clock3 size={17} /><span><strong>Pending admin approval:</strong> Current target: {currentTarget}. Requested target: <strong>{pending.requested_university?.name || 'selected university'}</strong>. Your current university remains active until an admin decides.</span></div><button className="btn btn-secondary btn-sm" type="button" onClick={() => setOpen(true)}>View request details</button></div> : <button className="btn btn-primary btn-sm" type="button" onClick={() => setOpen(true)}>Change Target University</button>}
  </>;

  return <section style={{ marginTop: '2rem', padding: '1.25rem', border: '1px solid var(--border)', borderRadius: 12, background: 'rgba(0,0,0,0.03)', width: '100%', boxSizing: 'border-box' }}>
    {summary}
    {open && verified && <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}><strong>Request a target-university change</strong><button className="btn btn-secondary btn-sm" type="button" onClick={() => setOpen(false)}>Close</button></div>
      {pending ? <div style={{ display: 'grid', gap: 10, marginTop: 12 }}><div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: '#fcd34d', fontSize: 13 }}><Clock3 size={17} /><span>Current target remains <strong>{currentTarget}</strong> until the relevant university admin reviews the request.</span></div><button className="btn btn-secondary btn-sm" disabled={submitting} onClick={() => void cancel(pending.id)}>Cancel request</button></div> : <>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: '#fcd34d', fontSize: 13, marginTop: 12, marginBottom: 12 }}><AlertTriangle size={17} /><span>Changing your target does not happen immediately. A university administrator must review and approve the request.</span></div>
        <label style={{ display: 'grid', gap: 6, fontSize: 13 }}><span>Requested university</span><select value={selected} onChange={(event) => setSelected(event.target.value)} style={{ width: '100%', padding: '0.7rem', background: 'var(--bg-300)', color: 'var(--text-100)', border: '1px solid var(--border)', borderRadius: 8 }}><option value="">Select an active university</option>{universities.filter((university) => university.id !== brand?.university_id).map((university) => <option value={university.id} key={university.id}>{university.name}{university.abbreviation ? ` (${university.abbreviation})` : ''}</option>)}</select></label>
        <label style={{ display: 'grid', gap: 6, fontSize: 13, marginTop: 12 }}><span>Why do you want to change your target university?</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={4} placeholder="Explain why your store should target this university…" style={{ width: '100%', padding: '0.7rem', background: 'var(--bg-300)', color: 'var(--text-100)', border: '1px solid var(--border)', borderRadius: 8, resize: 'vertical', boxSizing: 'border-box' }} /><small style={{ color: 'var(--text-400)' }}>{reason.length}/500 (minimum 10)</small></label>
        <button className="btn btn-primary btn-sm" style={{ marginTop: 12, display: 'inline-flex', gap: 7, alignItems: 'center' }} disabled={submitting || !selected || reason.trim().length < 10} onClick={() => void submit()}>{submitting ? <Loader2 size={15} className="anim-spin" /> : <Send size={15} />} {submitting ? 'Submitting…' : 'Submit request'}</button>
      </>}
    </div>}
    {message && <div role="status" style={{ marginTop: 12, display: 'flex', gap: 7, alignItems: 'center', color: message.toLowerCase().includes('submitted') || message.toLowerCase().includes('cancelled') ? '#86efac' : '#fca5a5', fontSize: 13 }}><CheckCircle2 size={15} /> {message}</div>}
    {requests.filter((request) => request.status !== 'PENDING').slice(0, 3).map((request) => <div key={request.id} style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-400)' }}>{request.status}: {request.requested_university?.name || 'university'} · {new Date(request.created_at).toLocaleDateString()}{request.admin_message ? ` · ${request.admin_message}` : ''}</div>)}
  </section>;
}

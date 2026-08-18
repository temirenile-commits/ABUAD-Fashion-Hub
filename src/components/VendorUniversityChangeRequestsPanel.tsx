'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock3, Loader2, MessageSquare, Search, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type RequestRow = {
  id: string; status: string; reason: string; created_at: string; admin_message?: string | null;
  brands?: { id: string; name: string; owner_id: string; verified?: boolean; verification_status?: string } | null;
  current_university?: { id: string; name: string; abbreviation?: string | null } | null;
  requested_university?: { id: string; name: string; abbreviation?: string | null } | null;
};

export default function VendorUniversityChangeRequestsPanel() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [status, setStatus] = useState('PENDING');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [messageFor, setMessageFor] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/university-admin?action=vendor_university_change_requests&status=${encodeURIComponent(status)}`, { headers: { Authorization: `Bearer ${session?.access_token || ''}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load requests.');
      setRequests(data.requests || []);
    } catch (error: any) { setFeedback(error.message || 'Unable to load requests.'); }
    finally { setLoading(false); }
  }, [status]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  const callAction = async (action: string, requestId: string, extra: Record<string, unknown> = {}) => {
    setBusy(requestId); setFeedback('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/university-admin', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` }, body: JSON.stringify({ action, requestId, ...extra }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Action failed.');
      setMessageFor(null); setMessage(''); setFeedback('Request updated successfully.'); await load();
    } catch (error: any) { setFeedback(error.message || 'Action failed.'); }
    finally { setBusy(''); }
  };

  const filtered = requests.filter((request) => {
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return [request.brands?.name, request.current_university?.name, request.requested_university?.name, request.reason].some((value) => String(value || '').toLowerCase().includes(needle));
  });

  return <section style={{ display: 'grid', gap: 16 }}>
    <div><h2 style={{ marginBottom: 4 }}>Vendor University Change Requests</h2><p style={{ marginTop: 0, color: 'var(--text-400)', fontSize: 13 }}>Review verified-vendor requests for this university. Approval changes the vendor target only after authorization.</p></div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><select value={status} onChange={(event) => setStatus(event.target.value)} style={{ padding: '0.65rem', background: 'var(--bg-300)', color: 'var(--text-100)', border: '1px solid var(--border)', borderRadius: 8 }}><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="ALL">All</option></select><label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 8, flex: 1, minWidth: 220 }}><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter vendor, current university, requested university…" style={{ width: '100%', border: 0, outline: 0, background: 'transparent', color: 'inherit', padding: '0.65rem' }} /></label></div>
    {loading ? <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Loader2 size={17} className="anim-spin" /> Loading requests…</div> : filtered.length === 0 ? <div style={{ padding: 18, border: '1px dashed var(--border)', borderRadius: 10, color: 'var(--text-400)' }}>No requests match this filter.</div> : filtered.map((request) => <article key={request.id} style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 12, background: 'rgba(0,0,0,0.03)', display: 'grid', gap: 10 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}><div><h3 style={{ margin: 0 }}>{request.brands?.name || 'Vendor'}</h3><p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-400)' }}>{request.current_university?.name || 'General'} → {request.requested_university?.name || 'Requested university'} · {new Date(request.created_at).toLocaleString()}</p></div><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: request.status === 'PENDING' ? '#fcd34d' : request.status === 'APPROVED' ? '#86efac' : '#fca5a5' }}>{request.status === 'PENDING' ? <Clock3 size={14} /> : request.status === 'APPROVED' ? <CheckCircle2 size={14} /> : <XCircle size={14} />} {request.status}</span></div><div style={{ padding: 12, borderRadius: 8, background: 'var(--bg-200)', fontSize: 13 }}><strong>Reason:</strong> {request.reason}</div>{request.admin_message && <div style={{ fontSize: 13, color: 'var(--text-400)' }}><strong>Admin message:</strong> {request.admin_message}</div>}{request.status === 'PENDING' && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button className="btn btn-primary btn-sm" disabled={busy === request.id} onClick={() => { if (window.confirm(`Approve ${request.brands?.name || 'this vendor'} to target ${request.requested_university?.name || 'the requested university'}?`)) void callAction('review_vendor_university_change_request', request.id, { decision: 'APPROVE' }); }}>Approve</button><button className="btn btn-secondary btn-sm" disabled={busy === request.id} onClick={() => { const value = window.prompt('Optional rejection message:') ?? ''; if (window.confirm('Reject this request?')) void callAction('review_vendor_university_change_request', request.id, { decision: 'REJECT', message: value }); }}>Reject</button><button className="btn btn-secondary btn-sm" disabled={busy === request.id} onClick={() => setMessageFor(request.id)}><MessageSquare size={14} /> Message vendor</button></div>}{messageFor === request.id && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write a message to the vendor" maxLength={1000} style={{ flex: 1, minWidth: 220, padding: '0.65rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-300)', color: 'inherit' }} /><button className="btn btn-primary btn-sm" disabled={!message.trim() || busy === request.id} onClick={() => void callAction('message_vendor_university_change_request', request.id, { message: message.trim() })}>Send</button></div>}</article>)}
    {feedback && <div role="status" style={{ fontSize: 13, color: feedback.includes('success') ? '#86efac' : '#fca5a5' }}>{feedback}</div>}
  </section>;
}

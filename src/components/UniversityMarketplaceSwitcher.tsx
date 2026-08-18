'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type University = { id: string; name: string; abbreviation?: string | null; location?: string | null };

export default function UniversityMarketplaceSwitcher() {
  const [current, setCurrent] = useState<University | null>(null);
  const [universities, setUniversities] = useState<University[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch('/api/university-context', { headers: { Authorization: `Bearer ${session?.access_token || ''}` } });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load universities.');
        if (!active) return;
        setCurrent(data.profile?.universities || null);
        setUniversities(data.universities || []);
      } catch (error: any) { if (active) setMessage(error.message || 'Unable to load universities.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  const confirmSwitch = async () => {
    if (!selected || selected === current?.id) return;
    const next = universities.find((university) => university.id === selected);
    if (!next) return;
    const confirmed = window.confirm(`Switch your marketplace to ${next.name}? Products in this university marketplace may not be available in your current area and may be sold or delivered specifically within that university region. Your account, authentication, orders, and referral history will remain unchanged; only your browsing context will change.`);
    if (!confirmed) return;
    setSaving(true); setMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/university-context', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` }, body: JSON.stringify({ action: 'switch_customer', universityId: selected }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to switch marketplace.');
      setCurrent(next); setSelected(''); setMessage(`Marketplace switched to ${next.name}. Refreshing your campus view…`);
      window.setTimeout(() => window.location.assign('/'), 250);
    } catch (error: any) { setMessage(error.message || 'Unable to switch marketplace.'); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ marginTop: '1.5rem', padding: '1.1rem', border: '1px solid var(--border)', borderRadius: 12 }}><Loader2 size={16} className="anim-spin" /> Loading marketplace universities…</div>;
  if (!universities.length) return <div style={{ marginTop: '1.5rem', color: 'var(--text-400)', fontSize: 13 }}>No active university marketplaces are available.</div>;

  return <section style={{ marginTop: '1.5rem', padding: '1.25rem', border: '1px solid var(--border)', borderRadius: 12, background: 'rgba(0,0,0,0.03)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}><MapPin size={18} color="var(--primary)" /><h2 style={{ margin: 0, fontSize: '1.05rem' }}>Marketplace University</h2></div>
    <p style={{ margin: '0 0 12px', color: 'var(--text-400)', fontSize: 13 }}>Current marketplace: <strong>{current?.name || 'General Marketplace'}</strong>. Select another university to browse its products, vendors, reels, and recommendations.</p>
    <div style={{ display: 'grid', gap: 10 }}>
      <select value={selected} onChange={(event) => setSelected(event.target.value)} disabled={saving} aria-label="Select marketplace university" style={{ width: '100%', padding: '0.7rem', background: 'var(--bg-300)', color: 'var(--text-100)', border: '1px solid var(--border)', borderRadius: 8 }}><option value="">Choose a university</option>{universities.map((university) => <option key={university.id} value={university.id}>{university.name}{university.abbreviation ? ` (${university.abbreviation})` : ''}</option>)}</select>
      {selected && selected !== current?.id && <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', color: '#fcd34d', fontSize: 13 }}><AlertTriangle size={17} /><span>Location warning: products, vendors, reels, and delivery options in this marketplace may be specific to {universities.find((university) => university.id === selected)?.name || 'the selected university'} and may not be available in your current area. Your account, orders, referral history, and vendor ownership will not move.</span></div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button type="button" className="btn btn-primary btn-sm" disabled={saving || !selected || selected === current?.id} onClick={() => void confirmSwitch()}>{saving ? <><Loader2 size={15} className="anim-spin" /> Switching…</> : 'Confirm switch'}</button>{selected && <button type="button" className="btn btn-secondary btn-sm" disabled={saving} onClick={() => setSelected('')}>Cancel</button>}</div>
    </div>
    {message && <div role="status" style={{ marginTop: 10, display: 'flex', gap: 7, alignItems: 'center', color: message.includes('switched') ? '#86efac' : '#fca5a5', fontSize: 13 }}><CheckCircle2 size={15} /> {message}</div>}
  </section>;
}

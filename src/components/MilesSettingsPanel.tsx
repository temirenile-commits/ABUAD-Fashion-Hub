'use client';

import { useEffect, useState } from 'react';
import { useMilesConfiguration } from '@/components/MilesConfigurationProvider';

const capabilityLabels: Record<string, string> = { products: 'Products', orders: 'Orders', finance: 'Finance', payouts: 'Payouts', users: 'Users', vendors: 'Vendors', support: 'Support', analytics: 'Analytics', university: 'University operations' };

type ScopeRow = { id: string; scope_type: string; university_id?: string | null; role_key?: string | null; config?: Record<string, unknown>; updated_at?: string };

export default function MilesSettingsPanel() {
  const { configuration, refresh } = useMilesConfiguration();
  const [name, setName] = useState(configuration.identity.name);
  const [readEnabled, setReadEnabled] = useState(configuration.permissions.readEnabled);
  const [writeEnabled, setWriteEnabled] = useState(configuration.permissions.writeEnabled);
  const [proactiveEnabled, setProactiveEnabled] = useState(configuration.assistance.proactiveEnabled);
  const [notificationsEnabled, setNotificationsEnabled] = useState(configuration.assistance.notificationsEnabled);
  const [tourGuideEnabled, setTourGuideEnabled] = useState(configuration.assistance.tourGuideEnabled);
  const [capabilities, setCapabilities] = useState(configuration.capabilities || {});
  const [context, setContext] = useState<{ roles: string[]; isOverallSuperAdmin: boolean; universityIds: string[] | null }>({ roles: [], isOverallSuperAdmin: false, universityIds: null });
  const [scopes, setScopes] = useState<ScopeRow[]>([]);
  const [scopeName, setScopeName] = useState('');
  const [scopeType, setScopeType] = useState<'GLOBAL' | 'UNIVERSITY'>('UNIVERSITY');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setName(configuration.identity.name); setReadEnabled(configuration.permissions.readEnabled); setWriteEnabled(configuration.permissions.writeEnabled); setProactiveEnabled(configuration.assistance.proactiveEnabled); setNotificationsEnabled(configuration.assistance.notificationsEnabled); setTourGuideEnabled(configuration.assistance.tourGuideEnabled); setCapabilities(configuration.capabilities || {});
  }, [configuration]);

  useEffect(() => { void (async () => { const response = await fetch('/api/miles/configuration', { cache: 'no-store' }); if (!response.ok) return; const data = await response.json(); setContext(data.context || { roles: [], isOverallSuperAdmin: false, universityIds: null }); setScopes(Array.isArray(data.scopes) ? data.scopes : []); })(); }, []);

  async function savePersonal() {
    const normalized = name.normalize('NFKC').replace(/[<>]/g, '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 40);
    if (!normalized) { setMessage('Choose a non-empty Miles name.'); return; }
    setSaving(true); setMessage('');
    try {
      const response = await fetch('/api/miles/configuration', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scopeType: 'USER', config: { identity: { name: normalized }, permissions: { readEnabled, writeEnabled }, assistance: { proactiveEnabled, notificationsEnabled, tourGuideEnabled }, capabilities }, reason: 'Personal Miles settings update' }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Miles settings could not be saved.');
      await refresh(); setMessage('Personal Miles settings saved.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Miles settings could not be saved.'); }
    finally { setSaving(false); }
  }

  async function saveScope() {
    if (!scopeName.trim() || !context.isOverallSuperAdmin) return;
    setSaving(true); setMessage('');
    try {
      const response = await fetch('/api/miles/configuration', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scopeType, config: { identity: { name: scopeName.trim().slice(0, 40) } }, reason: 'Administrative Miles scope update' }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Scope settings could not be saved.');
      setMessage('Administrative scope saved.'); setScopeName('');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Scope settings could not be saved.'); }
    finally { setSaving(false); }
  }

  return <section aria-labelledby="miles-settings-heading" style={{ marginTop: '1.5rem', padding: 18, borderRadius: 18, border: '1px solid rgba(255,255,255,.12)', background: 'linear-gradient(145deg,rgba(37,99,235,.13),rgba(15,23,42,.36))', color: '#fff' }}>
    <h2 id="miles-settings-heading" style={{ margin: 0, fontSize: 20 }}>Miles AI</h2>
    <p style={{ color: '#cbd5e1', fontSize: 13, margin: '7px 0 18px' }}>Personal settings control your Miles only. Platform provider settings remain restricted to the overall Super Admin.</p>
    <div style={{ display: 'grid', gap: 14 }}>
      <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>Miles name<input value={name} maxLength={40} onChange={(event) => setName(event.target.value)} style={inputStyle} aria-describedby="miles-name-help" /><span id="miles-name-help" style={{ color: '#94a3b8', fontSize: 11 }}>Use up to 40 safe characters. The bubble initial is derived automatically.</span></label>
      <div style={gridStyle}><Toggle label="Read Access" checked={readEnabled} onChange={setReadEnabled} /><Toggle label="Write Access" checked={writeEnabled} onChange={setWriteEnabled} /><Toggle label="Proactive Assistance" checked={proactiveEnabled} onChange={setProactiveEnabled} /><Toggle label="Notifications" checked={notificationsEnabled} onChange={setNotificationsEnabled} /><Toggle label="Tour Guide" checked={tourGuideEnabled} onChange={setTourGuideEnabled} /></div>
      <div><strong style={{ fontSize: 13 }}>Connected capabilities</strong><div style={{ display: 'grid', gap: 8, marginTop: 8 }}>{Object.entries(capabilities).map(([key, value]) => <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(15,23,42,.4)' }}><span style={{ fontSize: 12 }}>{capabilityLabels[key] || key}</span><span style={{ color: value?.read ? '#86efac' : '#94a3b8', fontSize: 11 }}>Read {value?.read ? 'ON' : 'OFF'} · Write {value?.write ? 'ON' : 'OFF'}</span></div>)}</div></div>
      <button type="button" onClick={() => void savePersonal()} disabled={saving} style={buttonStyle}>{saving ? 'Saving…' : 'Save Personal Miles'}</button>
      {context.isOverallSuperAdmin && <div style={{ marginTop: 10, paddingTop: 15, borderTop: '1px solid rgba(255,255,255,.12)' }}><strong>Super Admin scope configuration</strong><p style={{ color: '#cbd5e1', fontSize: 12 }}>Configure global and university overrides without changing personal settings.</p><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><select value={scopeType} onChange={(event) => setScopeType(event.target.value as 'GLOBAL' | 'UNIVERSITY')} style={inputStyle}><option value="GLOBAL">Global</option><option value="UNIVERSITY">University</option></select><input value={scopeName} onChange={(event) => setScopeName(event.target.value)} maxLength={40} placeholder="Scoped Miles name" style={{ ...inputStyle, flex: 1, minWidth: 160 }} /><button type="button" onClick={() => void saveScope()} disabled={saving || !scopeName.trim()} style={buttonStyle}>Save Scope</button></div><div style={{ display: 'grid', gap: 6, marginTop: 10 }}>{scopes.map((scope) => <div key={scope.id} style={{ fontSize: 11, color: '#cbd5e1' }}>{scope.scope_type} · {scope.role_key || scope.university_id || 'global'} · updated {scope.updated_at ? new Date(scope.updated_at).toLocaleString() : '—'}</div>)}</div></div>}
      {message && <div role="status" aria-live="polite" style={{ color: message.includes('saved') ? '#86efac' : '#fca5a5', fontSize: 12 }}>{message}</div>}
    </div>
  </section>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '9px 10px', borderRadius: 10, background: 'rgba(15,23,42,.4)', fontSize: 12 }}>{label}<input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} aria-label={label} /></label>; }
const inputStyle: React.CSSProperties = { border: '1px solid rgba(255,255,255,.16)', borderRadius: 10, background: '#111827', color: '#fff', padding: '9px 10px' };
const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 };
const buttonStyle: React.CSSProperties = { border: 0, borderRadius: 10, padding: '10px 14px', background: 'linear-gradient(135deg,#2563eb,#4f46e5)', color: '#fff', fontWeight: 700, cursor: 'pointer' };

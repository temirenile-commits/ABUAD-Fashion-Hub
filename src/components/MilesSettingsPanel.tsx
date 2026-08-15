'use client';

import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useMilesConfiguration } from '@/components/MilesConfigurationProvider';
import { supabase } from '@/lib/supabase';

const capabilityLabels: Record<string, string> = { products: 'Products', orders: 'Orders', finance: 'Finance', payouts: 'Payouts', users: 'Users', vendors: 'Vendors', support: 'Support', analytics: 'Analytics', university: 'University operations' };
type ScopeRow = { id: string; scope_type: string; university_id?: string | null; role_key?: string | null; updated_at?: string };
type AuthSession = { access_token: string };

export default function MilesSettingsPanel() {
  const { configuration, refresh } = useMilesConfiguration();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [name, setName] = useState(configuration.identity.name);
  const [readEnabled, setReadEnabled] = useState(configuration.permissions.readEnabled);
  const [writeEnabled, setWriteEnabled] = useState(configuration.permissions.writeEnabled);
  const [proactiveEnabled, setProactiveEnabled] = useState(configuration.assistance.proactiveEnabled);
  const [notificationsEnabled, setNotificationsEnabled] = useState(configuration.assistance.notificationsEnabled);
  const [tourGuideEnabled, setTourGuideEnabled] = useState(configuration.assistance.tourGuideEnabled);
  const [capabilities, setCapabilities] = useState(configuration.capabilities || {});
  const [vendor, setVendor] = useState(configuration.vendor || { aiEnabled: true, autoReplyEnabled: false, customInstructions: '', storeAccessEnabled: false, storeWriteEnabled: false });
  const [context, setContext] = useState<{ roles: string[]; isOverallSuperAdmin: boolean; universityIds: string[] | null; brandIds?: string[] }>({ roles: [], isOverallSuperAdmin: false, universityIds: null });
  const [scopes, setScopes] = useState<ScopeRow[]>([]);
  const [scopeName, setScopeName] = useState('');
  const [scopeType, setScopeType] = useState<'GLOBAL' | 'UNIVERSITY'>('UNIVERSITY');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function getAuthHeaders() {
    const { data } = await supabase.auth.getSession();
    const activeSession = data.session as AuthSession | null;
    setSession(activeSession);
    return activeSession ? { Authorization: `Bearer ${activeSession.access_token}` } : null;
  }

  async function loadSettings() {
    const headers = await getAuthHeaders();
    if (!headers) { setMessage('Please sign in again to manage Miles settings.'); return; }
    const response = await fetch('/api/miles/configuration', { headers, cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(data.error || 'Miles settings could not be loaded.'); return; }
    setContext(data.context || { roles: [], isOverallSuperAdmin: false, universityIds: null });
    setScopes(Array.isArray(data.scopes) ? data.scopes : []);
  }

  useEffect(() => {
    setName(configuration.identity.name); setReadEnabled(configuration.permissions.readEnabled); setWriteEnabled(configuration.permissions.writeEnabled); setProactiveEnabled(configuration.assistance.proactiveEnabled); setNotificationsEnabled(configuration.assistance.notificationsEnabled); setTourGuideEnabled(configuration.assistance.tourGuideEnabled); setCapabilities(configuration.capabilities || {});
    if (configuration.vendor) setVendor(configuration.vendor);
  }, [configuration]);

  useEffect(() => { void loadSettings(); }, []);

  async function savePersonal() {
    const normalized = name.normalize('NFKC').replace(/[<>]/g, '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 40);
    if (!normalized) { setMessage('Choose a non-empty Miles name.'); return; }
    setSaving(true); setMessage('');
    try {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Authentication required. Please sign in again.');
      const response = await fetch('/api/miles/configuration', { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ scopeType: 'USER', config: { identity: { name: normalized }, permissions: { readEnabled, writeEnabled }, assistance: { proactiveEnabled, notificationsEnabled, tourGuideEnabled }, capabilities, vendor }, reason: 'Unified personal Miles settings update' }) });
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || 'Miles settings could not be saved.');
      await refresh(); await loadSettings(); setMessage('Your unified Miles settings were saved.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Miles settings could not be saved.'); }
    finally { setSaving(false); }
  }

  async function saveScope() {
    if (!scopeName.trim() || !context.isOverallSuperAdmin) return;
    setSaving(true); setMessage('');
    try {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Authentication required. Please sign in again.');
      const response = await fetch('/api/miles/configuration', { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ scopeType, config: { identity: { name: scopeName.trim().slice(0, 40) } }, reason: 'Administrative Miles scope update' }) });
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || 'Scope settings could not be saved.');
      setMessage('Administrative scope saved.'); setScopeName(''); await loadSettings(); await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Scope settings could not be saved.'); }
    finally { setSaving(false); }
  }

  const isVendor = context.roles.includes('vendor') || Boolean(context.brandIds?.length) || Boolean(configuration.vendor);
  const roleLabel = context.roles.length ? context.roles.join(' · ').replaceAll('_', ' ') : 'authenticated user';

  return <section aria-labelledby="miles-settings-heading" style={panelStyle}>
    <h2 id="miles-settings-heading" style={{ margin: 0, fontSize: 20 }}>Miles Settings</h2>
    <p style={mutedStyle}>One Miles assistant, configured for your role. These controls update the same identity and session used by the bubble, docked panel, fullscreen chat, and copilot.</p>
    <div style={roleBadge}>Active role: {roleLabel}</div>
    <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
      <div style={cardStyle}><h3 style={headingStyle}>Personal Miles</h3><p style={mutedStyle}>These settings affect only your authenticated Miles assistant. They remain separate from any university or system-wide override.</p>
        <label style={labelStyle}>Miles name<input value={name} maxLength={40} onChange={(event) => setName(event.target.value)} style={inputStyle} /><span style={helpStyle}>The bubble and profile initial update automatically from the first meaningful character.</span></label>
        <div style={gridStyle}><Toggle label="Read Access" checked={readEnabled} onChange={setReadEnabled} /><Toggle label="Write Access" checked={writeEnabled} onChange={setWriteEnabled} /><Toggle label="Proactive Assistance" checked={proactiveEnabled} onChange={setProactiveEnabled} /><Toggle label="Notifications" checked={notificationsEnabled} onChange={setNotificationsEnabled} /><Toggle label="Conversation Tour" checked={tourGuideEnabled} onChange={setTourGuideEnabled} /></div>
      </div>
      <div style={cardStyle}><h3 style={headingStyle}>Role capabilities</h3><p style={mutedStyle}>The available controls are composed from your role, permissions, university scope, vendor relationship, and personal settings. This does not create another Miles instance.</p><div style={{ display: 'grid', gap: 8 }}>{Object.entries(capabilities).map(([key, value]) => <div key={key} style={capabilityRow}><span>{capabilityLabels[key] || key}</span><span style={{ color: value?.read ? '#86efac' : '#94a3b8', fontSize: 11 }}>Read {value?.read ? 'ON' : 'OFF'} · Write {value?.write ? 'ON' : 'OFF'}</span></div>)}</div></div>
      {isVendor && <div style={cardStyle}><h3 style={headingStyle}>Vendor capabilities</h3><p style={mutedStyle}>These are vendor features on your same Miles assistant. Store access is conservative by default; write operations still require controlled backend actions and confirmation for sensitive changes.</p><div style={gridStyle}><Toggle label="Miles enabled" checked={vendor.aiEnabled} onChange={(value) => setVendor({ ...vendor, aiEnabled: value })} /><Toggle label="Store read access" checked={vendor.storeAccessEnabled} onChange={(value) => setVendor({ ...vendor, storeAccessEnabled: value })} /><Toggle label="Store write access" checked={vendor.storeWriteEnabled} onChange={(value) => setVendor({ ...vendor, storeWriteEnabled: value })} /><Toggle label="Customer auto-reply" checked={vendor.autoReplyEnabled} onChange={(value) => setVendor({ ...vendor, autoReplyEnabled: value })} /></div><label style={{ ...labelStyle, marginTop: 12 }}>Vendor instructions<textarea rows={4} maxLength={2000} value={vendor.customInstructions} onChange={(event) => setVendor({ ...vendor, customInstructions: event.target.value })} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Optional store guidance for Miles" /></label></div>}
      <button type="button" onClick={() => void savePersonal()} disabled={saving || !session} style={buttonStyle}>{saving ? 'Saving…' : !session ? 'Sign in to save Miles settings' : 'Save unified Miles settings'}</button>
      {context.isOverallSuperAdmin && <div style={cardStyle}><h3 style={headingStyle}>Authorized scope settings</h3><p style={mutedStyle}>MasterCart Miles scope settings are available only to the overall Super Admin. They affect eligible users through inheritance; they do not create a second assistant.</p><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><select value={scopeType} onChange={(event) => setScopeType(event.target.value as 'GLOBAL' | 'UNIVERSITY')} style={inputStyle}><option value="GLOBAL">Global</option><option value="UNIVERSITY">University</option></select><input value={scopeName} onChange={(event) => setScopeName(event.target.value)} maxLength={40} placeholder="Scoped Miles name" style={{ ...inputStyle, flex: 1, minWidth: 160 }} /><button type="button" onClick={() => void saveScope()} disabled={saving || !scopeName.trim()} style={buttonStyle}>Save scope</button></div><div style={{ display: 'grid', gap: 6, marginTop: 10 }}>{scopes.map((scope) => <div key={scope.id} style={helpStyle}>{scope.scope_type} · {scope.role_key || scope.university_id || 'global'} · updated {scope.updated_at ? new Date(scope.updated_at).toLocaleString() : '—'}</div>)}</div></div>}
      {message && <div role="status" aria-live="polite" style={{ color: message.toLowerCase().includes('saved') ? '#86efac' : '#fca5a5', fontSize: 12 }}>{message}</div>}
    </div>
  </section>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '9px 10px', borderRadius: 10, background: 'rgba(15,23,42,.4)', fontSize: 12 }}>{label}<input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} aria-label={label} /></label>; }
const panelStyle: CSSProperties = { marginTop: '1.5rem', padding: 18, borderRadius: 18, border: '1px solid rgba(255,255,255,.12)', background: 'linear-gradient(145deg,rgba(37,99,235,.13),rgba(15,23,42,.36))', color: '#fff' };
const cardStyle: CSSProperties = { padding: 14, borderRadius: 14, background: 'rgba(15,23,42,.4)', border: '1px solid rgba(255,255,255,.08)' };
const headingStyle: CSSProperties = { margin: 0, fontSize: 15 };
const mutedStyle: CSSProperties = { color: '#cbd5e1', fontSize: 13, margin: '7px 0 12px', lineHeight: 1.5 };
const helpStyle: CSSProperties = { color: '#94a3b8', fontSize: 11 };
const labelStyle: CSSProperties = { display: 'grid', gap: 6, fontSize: 13 };
const inputStyle: CSSProperties = { border: '1px solid rgba(255,255,255,.16)', borderRadius: 10, background: '#111827', color: '#fff', padding: '9px 10px' };
const gridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8 };
const capabilityRow: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(15,23,42,.55)', fontSize: 12 };
const roleBadge: CSSProperties = { display: 'inline-flex', padding: '5px 9px', borderRadius: 999, background: 'rgba(96,165,250,.15)', color: '#bfdbfe', fontSize: 11, textTransform: 'capitalize' };
const buttonStyle: CSSProperties = { border: 0, borderRadius: 10, padding: '10px 14px', background: 'linear-gradient(135deg,#2563eb,#4f46e5)', color: '#fff', fontWeight: 700, cursor: 'pointer' };

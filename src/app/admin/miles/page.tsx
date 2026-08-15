'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const categories = ['products', 'orders', 'finance', 'payouts', 'users', 'vendors', 'support', 'analytics', 'university'];

type Scope = { id: string; scope_type: string; university_id?: string | null; role_key?: string | null; config?: Record<string, any>; updated_at?: string };

export default function AdminMilesPage() {
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<'my' | 'scope' | 'permissions' | 'automation' | 'audit'>('my');
  const [name, setName] = useState('');
  const [selectedScope, setSelectedScope] = useState<Scope | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  async function load() { const response = await fetch('/api/miles/configuration', { cache: 'no-store' }); if (response.ok) { const result = await response.json(); setData(result); setName(result.effective?.identity?.name || 'Miles'); } }
  useEffect(() => { void load(); }, []);

  async function save(scopeType: 'USER' | 'GLOBAL' | 'UNIVERSITY', scope?: Scope) {
    setSaving(true); setNotice('');
    const body: any = { scopeType, config: { identity: { name: name.trim().slice(0, 40) } }, reason: 'Miles administrative configuration update' };
    if (scope?.university_id) body.universityId = scope.university_id;
    if (scope?.role_key) body.roleKey = scope.role_key;
    const response = await fetch('/api/miles/configuration', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json(); setNotice(response.ok ? 'Miles configuration saved and audited.' : (result.error || 'Configuration failed.')); setSaving(false); if (response.ok) void load();
  }

  if (!data) return <main style={pageStyle}><p>Loading Miles configuration…</p></main>;
  const context = data.context || {};
  const scopes: Scope[] = data.scopes || [];
  const audits = data.audit || [];
  const canManageScopes = Boolean(context.isOverallSuperAdmin || (context.roles || []).some((role: string) => role === 'university_admin' || role === 'university_staff'));

  return <main style={pageStyle}>
    <div style={headerStyle}><div><Link href="/admin" style={backStyle}>← Admin Dashboard</Link><h1 style={{ margin: '12px 0 4px' }}>Miles AI Configuration</h1><p style={{ color: '#94a3b8', margin: 0 }}>One Miles engine with effective configuration inherited by scope.</p></div><div style={badgeStyle}>{context.isOverallSuperAdmin ? 'Super Admin' : 'Administrator'}</div></div>
    <nav style={navStyle}>{[['my', 'My Miles'], ['scope', 'Scope Configuration'], ['permissions', 'Permissions'], ['automation', 'Automation'], ['audit', 'Audit Log']].map(([value, label]) => <button key={value} type="button" onClick={() => setTab(value as typeof tab)} style={{ ...tabStyle, ...(tab === value ? activeTabStyle : {}) }}>{label}</button>)}</nav>
    {tab === 'my' && <section style={cardStyle}><h2>Personal Miles</h2><p style={description}>These settings affect your own Miles only and are persisted in the database.</p><label style={labelStyle}>Miles name<input value={name} maxLength={40} onChange={(event) => setName(event.target.value)} style={inputStyle} /></label><button type="button" disabled={saving || !name.trim()} onClick={() => void save('USER')} style={buttonStyle}>Save My Miles</button></section>}
    {tab === 'scope' && <section style={cardStyle}><h2>Scope Configuration</h2><p style={description}>Super Admins can manage global and university overrides. University administrators are limited to their assigned universities.</p>{canManageScopes && <div style={{ display: 'grid', gap: 9 }}>{scopes.map((scope) => <button key={scope.id} type="button" onClick={() => { setSelectedScope(scope); setName(scope.config?.identity?.name || 'Miles'); }} style={scopeRowStyle}><span><strong>{scope.scope_type}</strong> · {scope.role_key || scope.university_id || 'Global'}</span><span>{scope.config?.identity?.name || 'Miles'} · {scope.updated_at ? new Date(scope.updated_at).toLocaleDateString() : '—'}</span></button>)}</div>}{selectedScope && <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: '#111827' }}><label style={labelStyle}>Scoped Miles name<input value={name} maxLength={40} onChange={(event) => setName(event.target.value)} style={inputStyle} /></label><button type="button" disabled={saving} onClick={() => void save(selectedScope.scope_type as 'GLOBAL' | 'UNIVERSITY', selectedScope)} style={buttonStyle}>Save Scope</button></div>}</section>}
    {tab === 'permissions' && <section style={cardStyle}><h2>Granular Permissions</h2><p style={description}>Read and write are separate category permissions. High-risk and financial mutations always require backend authorization and confirmation.</p><div style={gridStyle}>{categories.map((category) => <div key={category} style={permissionRow}><strong>{category[0].toUpperCase() + category.slice(1)}</strong><span>Read {data.effective?.capabilities?.[category]?.read ? 'ON' : 'OFF'}</span><span>Write {data.effective?.capabilities?.[category]?.write ? 'ON' : 'OFF'}</span></div>)}</div></section>}
    {tab === 'automation' && <section style={cardStyle}><h2>Automation and Safety</h2><p style={description}>Proactive assistance, notifications, and tour behavior follow effective scope configuration. Sensitive actions remain confirmation-gated, audited, and validated by MasterCart backend rules.</p><div style={gridStyle}><div style={permissionRow}>Proactive assistance <strong>{data.effective?.assistance?.proactiveEnabled ? 'ON' : 'OFF'}</strong></div><div style={permissionRow}>Notifications <strong>{data.effective?.assistance?.notificationsEnabled ? 'ON' : 'OFF'}</strong></div><div style={permissionRow}>Tour guide <strong>{data.effective?.assistance?.tourGuideEnabled ? 'ON' : 'OFF'}</strong></div><div style={permissionRow}>High-risk confirmation <strong>REQUIRED</strong></div><div style={permissionRow}>Financial source of truth <strong>MasterCart backend</strong></div></div>{context.isOverallSuperAdmin && <p style={{ color: '#fbbf24', fontSize: 12, marginTop: 14 }}>Provider and fallback configuration is intentionally restricted to this Super Admin surface and is not exposed to ordinary users.</p>}</section>}
    {tab === 'audit' && <section style={cardStyle}><h2>Audit Log</h2><p style={description}>Configuration changes are recorded with actor, scope, setting, old value, new value, timestamp, and reason.</p>{audits.length ? audits.map((audit: any) => <div key={audit.id} style={auditRow}><strong>{audit.setting_changed}</strong><span>{audit.scope_type} · {audit.created_at ? new Date(audit.created_at).toLocaleString() : '—'}</span><small>{audit.reason || 'No reason supplied'}</small></div>) : <p style={{ color: '#94a3b8' }}>No configuration changes recorded yet.</p>}</section>}
    {notice && <p role="status" style={{ color: notice.includes('saved') ? '#86efac' : '#fca5a5' }}>{notice}</p>}
  </main>;
}

const pageStyle: React.CSSProperties = { minHeight: '100dvh', padding: '32px max(18px,5vw)', background: '#070b14', color: '#f8fafc' };
const headerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', maxWidth: 1100, margin: '0 auto' };
const backStyle: React.CSSProperties = { color: '#93c5fd', textDecoration: 'none', fontSize: 13 };
const badgeStyle: React.CSSProperties = { padding: '8px 12px', borderRadius: 999, background: 'rgba(37,99,235,.2)', color: '#bfdbfe', fontSize: 12 };
const navStyle: React.CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', maxWidth: 1100, margin: '28px auto 16px' };
const tabStyle: React.CSSProperties = { border: '1px solid rgba(255,255,255,.12)', borderRadius: 10, background: '#111827', color: '#cbd5e1', padding: '9px 12px', cursor: 'pointer' };
const activeTabStyle: React.CSSProperties = { background: '#2563eb', color: '#fff' };
const cardStyle: React.CSSProperties = { maxWidth: 1100, margin: '0 auto', padding: 20, borderRadius: 18, background: 'linear-gradient(145deg,#0f172a,#111827)', border: '1px solid rgba(255,255,255,.12)' };
const description: React.CSSProperties = { color: '#94a3b8', fontSize: 13, lineHeight: 1.5 };
const labelStyle: React.CSSProperties = { display: 'grid', gap: 7, fontSize: 13, color: '#cbd5e1', margin: '18px 0' };
const inputStyle: React.CSSProperties = { border: '1px solid rgba(255,255,255,.16)', borderRadius: 10, background: '#070b14', color: '#fff', padding: '10px 12px', width: '100%', boxSizing: 'border-box' };
const buttonStyle: React.CSSProperties = { border: 0, borderRadius: 10, padding: '10px 14px', background: 'linear-gradient(135deg,#2563eb,#4f46e5)', color: '#fff', fontWeight: 700, cursor: 'pointer' };
const scopeRowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: 12, background: '#111827', color: '#e2e8f0', textAlign: 'left', cursor: 'pointer' };
const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 };
const permissionRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 8, padding: 12, borderRadius: 10, background: '#111827', color: '#cbd5e1', fontSize: 13 };
const auditRow: React.CSSProperties = { display: 'grid', gap: 4, padding: 12, borderBottom: '1px solid rgba(255,255,255,.08)', fontSize: 13 };

'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

type Message = { role: 'user' | 'assistant'; content: string };
type Proposal = { actionId: string; confirmationPhrase: string; summary: string; highRisk?: boolean; expiresAt?: string; domain?: 'admin' | 'vendor' };

export default function MilesGlobalWorkspace() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: 'Hi. I’m Miles. How can I help you with MasterCart today?' }]);

  useEffect(() => {
    const openPanel = () => setOpen(true);
    const openFull = () => { setOpen(true); setFull(true); };
    window.addEventListener('mastercart:miles-open', openPanel);
    window.addEventListener('mastercart:miles-full-open', openFull);
    return () => {
      window.removeEventListener('mastercart:miles-open', openPanel);
      window.removeEventListener('mastercart:miles-full-open', openFull);
    };
  }, []);

  const visible = open && !pathname.startsWith('/dashboard/vendor') && !pathname.startsWith('/dashboard/delicacies');
  const panelWidth = useMemo(() => full ? 'min(720px, calc(100vw - 32px))' : 'min(420px, calc(100vw - 24px))', [full]);

  async function send() {
    const content = input.trim();
    if (!content || busy) return;
    const next = [...messages, { role: 'user' as const, content }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const response = await fetch('/api/ai/copilot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: next, pathname, currentTab: 'overview' }) });
      const data = await response.json();
      if (data.proposal) setProposal({ ...data.proposal, domain: data.domain });
      setMessages([...next, { role: 'assistant', content: data.text || data.proposal?.summary || data.error || 'Miles is temporarily unavailable. Please try again shortly.' }]);
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Miles is temporarily unavailable. Please try again shortly.' }]);
    } finally { setBusy(false); }
  }

  async function confirmAction() {
    if (!proposal || busy) return;
    setBusy(true);
    try {
      const domain = proposal.domain || 'vendor';
      const response = await fetch('/api/ai/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domain, mode: 'confirm', actionId: proposal.actionId, confirmation: proposal.confirmationPhrase }) });
      const data = await response.json();
      setMessages((previous) => [...previous, { role: 'assistant', content: data.result?.summary || data.error || 'I could not complete that action. The system did not confirm the change.' }]);
      if (data.result) setProposal(null);
    } catch { setMessages((previous) => [...previous, { role: 'assistant', content: 'I could not complete that action. The system did not confirm the change.' }]); }
    finally { setBusy(false); }
  }

  if (!visible) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', right: 16, bottom: 'calc(16px + env(safe-area-inset-bottom))', width: panelWidth, maxHeight: 'min(760px, calc(100vh - 32px))', display: 'flex', flexDirection: 'column', overflow: 'hidden', pointerEvents: 'auto', border: '1px solid rgba(125,211,252,.35)', borderRadius: 24, background: 'linear-gradient(160deg, rgba(8,47,73,.98), rgba(30,27,75,.98))', color: '#ecfeff', boxShadow: '0 30px 80px rgba(2,6,23,.55)' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid rgba(165,243,252,.14)' }}>
          <div><strong style={{ fontSize: 18 }}>Miles</strong><div style={{ fontSize: 12, color: '#a5f3fc', marginTop: 3 }}>MasterCart intelligence</div></div>
          <div style={{ display: 'flex', gap: 8 }}><button type="button" onClick={() => setFull((value) => !value)} aria-label="Toggle Miles workspace size" style={iconButton}>{full ? '−' : '□'}</button><button type="button" onClick={() => setOpen(false)} aria-label="Close Miles workspace" style={iconButton}>×</button></div>
        </header>
        <div style={{ flex: 1, minHeight: full ? 420 : 280, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map((message, index) => <div key={`${message.role}-${index}`} style={{ alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%', padding: '10px 12px', borderRadius: message.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', background: message.role === 'user' ? 'linear-gradient(135deg,#2563eb,#7c3aed)' : 'rgba(15,118,110,.38)', whiteSpace: 'pre-wrap', lineHeight: 1.45, fontSize: 14 }}>{message.content}</div>)}
          {proposal && <div style={{ padding: 12, borderRadius: 16, border: '1px solid rgba(251,191,36,.5)', background: 'rgba(120,53,15,.28)' }}><div style={{ fontSize: 13, color: '#fde68a', marginBottom: 10 }}>Confirmation required</div><div style={{ fontSize: 13, marginBottom: 10 }}>{proposal.summary}</div><div style={{ display: 'flex', gap: 8 }}><button type="button" disabled={busy} onClick={confirmAction} style={confirmButton}>Confirm action</button><button type="button" disabled={busy} onClick={() => setProposal(null)} style={cancelButton}>Cancel</button></div></div>}
        </div>
        <form onSubmit={(event) => { event.preventDefault(); send(); }} style={{ display: 'flex', gap: 8, padding: 14, borderTop: '1px solid rgba(165,243,252,.14)' }}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask Miles..." aria-label="Ask Miles" style={{ flex: 1, minWidth: 0, border: '1px solid rgba(165,243,252,.22)', borderRadius: 14, background: 'rgba(2,6,23,.42)', color: '#ecfeff', padding: '11px 12px', outline: 'none' }} /><button type="submit" disabled={busy || !input.trim()} style={sendButton}>{busy ? '…' : '↑'}</button></form>
      </div>
    </div>
  );
}

const iconButton = { border: '1px solid rgba(165,243,252,.25)', borderRadius: 10, background: 'rgba(15,23,42,.35)', color: '#ecfeff', width: 32, height: 32, cursor: 'pointer' };
const confirmButton = { border: 'none', borderRadius: 10, background: '#f59e0b', color: '#172033', padding: '8px 12px', fontWeight: 700, cursor: 'pointer' };
const cancelButton = { border: '1px solid rgba(254,243,199,.35)', borderRadius: 10, background: 'transparent', color: '#fef3c7', padding: '8px 12px', cursor: 'pointer' };
const sendButton = { border: 'none', borderRadius: 14, background: 'linear-gradient(135deg,#22d3ee,#2563eb)', color: '#eff6ff', width: 46, cursor: 'pointer', fontSize: 18 };

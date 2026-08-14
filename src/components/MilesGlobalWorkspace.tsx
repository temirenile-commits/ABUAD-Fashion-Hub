'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MILES_ASSISTANT_NAME, MILES_ASSISTANT_SUBTITLE, MILES_MESSAGES } from '@/lib/ai/ui-config';

type Message = { role: 'user' | 'assistant'; content: string };
type Proposal = { actionId: string; confirmationPhrase: string; summary: string; highRisk?: boolean; expiresAt?: string; domain?: 'admin' | 'vendor' };

const initialMessage: Message = { role: 'assistant', content: `Hi. I’m ${MILES_ASSISTANT_NAME}. How can I help you with MasterCart today?` };

function safeText(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

export default function MilesGlobalWorkspace() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [messages, setMessages] = useState<Message[]>([initialMessage]);

  useEffect(() => {
    const openPanel = () => { setOpen(true); setFull(false); };
    const openFull = () => { setOpen(true); setFull(true); };
    window.addEventListener('mastercart:miles-open', openPanel);
    window.addEventListener('mastercart:miles-full-open', openFull);
    return () => {
      window.removeEventListener('mastercart:miles-open', openPanel);
      window.removeEventListener('mastercart:miles-full-open', openFull);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); if (full) setFull(false); else setOpen(false); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, full]);

  useEffect(() => {
    if (!open) return;
    const onPopState = () => {
      if (full) setFull(false);
      else setOpen(false);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [open, full]);

  async function send() {
    const content = input.trim();
    if (!content || busy) return;
    const next = [...messages, { role: 'user' as const, content }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const response = await fetch('/api/ai/copilot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: next, pathname, currentTab: 'overview' }) });
      if (!response.ok) throw new Error('Miles request failed');
      const data = await response.json() as { text?: unknown; proposal?: Proposal; domain?: 'admin' | 'vendor' };
      if (data.proposal) setProposal({ ...data.proposal, domain: data.domain });
      setMessages([...next, { role: 'assistant', content: data.proposal?.summary || safeText(data.text, MILES_MESSAGES.unavailable) }]);
    } catch {
      setMessages([...next, { role: 'assistant', content: MILES_MESSAGES.unavailable }]);
    } finally { setBusy(false); }
  }

  async function confirmAction() {
    if (!proposal || busy) return;
    setBusy(true);
    try {
      const response = await fetch('/api/ai/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domain: proposal.domain || 'vendor', mode: 'confirm', actionId: proposal.actionId, confirmation: proposal.confirmationPhrase }) });
      if (!response.ok) throw new Error('Action confirmation failed');
      const data = await response.json() as { result?: { summary?: unknown } };
      setMessages((previous) => [...previous, { role: 'assistant', content: safeText(data.result?.summary, MILES_MESSAGES.actionFailed) }]);
      if (data.result) setProposal(null);
    } catch { setMessages((previous) => [...previous, { role: 'assistant', content: MILES_MESSAGES.actionFailed }]); }
    finally { setBusy(false); }
  }

  const panelWidth = useMemo(() => full ? 'min(720px, calc(100vw - 24px))' : 'min(380px, calc(100vw - 24px))', [full]);
  if (!open) return null;

  const close = () => { setFull(false); setOpen(false); };
  const panelStyle = full ? { position: 'fixed' as const, inset: 0, width: '100vw', height: '100dvh', borderRadius: 0, background: '#000' } : { position: 'fixed' as const, right: 16, bottom: 'calc(16px + env(safe-area-inset-bottom))', width: panelWidth, maxHeight: 'min(680px, calc(100dvh - 32px))', borderRadius: 20, background: '#0b0d0c' };

  return (
    <div role="presentation" onClick={(event) => event.stopPropagation()} style={{ position: 'fixed', inset: 0, zIndex: full ? 9999 : 1100, pointerEvents: 'none' }}>
      <section role="dialog" aria-modal={full} aria-label={`${MILES_ASSISTANT_NAME} ${full ? 'fullscreen' : 'chat'} assistant`} style={{ ...panelStyle, display: 'flex', flexDirection: 'column', overflow: 'hidden', pointerEvents: 'auto', color: '#fff', border: full ? 'none' : '1px solid rgba(255,255,255,.10)', boxShadow: full ? 'none' : '0 24px 70px rgba(0,0,0,.55)', animation: 'miles-panel-in 180ms ease-out' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: full ? '18px max(18px, env(safe-area-inset-left))' : '14px 16px', borderBottom: '1px solid rgba(255,255,255,.10)', flexShrink: 0 }}>
          <div><strong style={{ fontSize: 18 }}>{MILES_ASSISTANT_NAME}</strong><div style={{ fontSize: 12, color: '#9ca3af', marginTop: 3 }}>{MILES_ASSISTANT_SUBTITLE}</div></div>
          <div style={{ display: 'flex', gap: 8 }}>
            {full && <button type="button" onClick={() => setFull(false)} aria-label={`Return to ${MILES_ASSISTANT_NAME} compact panel`} style={iconButton}>←</button>}
            {!full && <button type="button" onClick={() => setFull(true)} aria-label={`Open ${MILES_ASSISTANT_NAME} fullscreen`} style={iconButton}>□</button>}
            <button type="button" onClick={() => full ? setFull(false) : close()} aria-label={full ? `Minimize ${MILES_ASSISTANT_NAME}` : `Close ${MILES_ASSISTANT_NAME}`} style={iconButton}>{full ? '−' : '×'}</button>
          </div>
        </header>
        <div style={{ flex: 1, minHeight: full ? 0 : 280, overflowY: 'auto', padding: full ? '24px max(18px, env(safe-area-inset-left))' : 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map((message, index) => <div key={`${message.role}-${index}`} style={{ alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%', padding: '10px 12px', borderRadius: message.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', border: message.role === 'user' ? '1px solid rgba(0,211,154,.20)' : '1px solid rgba(255,255,255,.08)', background: message.role === 'user' ? 'rgba(0,211,154,.12)' : '#111413', whiteSpace: 'pre-wrap', lineHeight: 1.45, fontSize: 14 }}>{message.content}</div>)}
          {busy && <div role="status" aria-live="polite" style={{ color: '#9ca3af', fontSize: 13 }}>{MILES_MESSAGES.thinking}</div>}
          {proposal && <div style={{ padding: 12, borderRadius: 16, border: '1px solid rgba(251,191,36,.5)', background: 'rgba(120,53,15,.28)' }}><div style={{ fontSize: 13, color: '#fde68a', marginBottom: 10 }}>Confirmation required</div><div style={{ fontSize: 13, marginBottom: 10 }}>{proposal.summary}</div><div style={{ display: 'flex', gap: 8 }}><button type="button" disabled={busy} onClick={confirmAction} style={confirmButton}>Confirm action</button><button type="button" disabled={busy} onClick={() => setProposal(null)} style={cancelButton}>Cancel</button></div></div>}
        </div>
        <form onSubmit={(event) => { event.preventDefault(); send(); }} style={{ display: 'flex', gap: 8, padding: 14, paddingBottom: 'calc(14px + env(safe-area-inset-bottom))', borderTop: '1px solid rgba(255,255,255,.10)', flexShrink: 0 }}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder={`Ask ${MILES_ASSISTANT_NAME}...`} aria-label={`Ask ${MILES_ASSISTANT_NAME}`} autoComplete="off" style={{ flex: 1, minWidth: 0, border: '1px solid rgba(255,255,255,.12)', borderRadius: 14, background: '#111413', color: '#fff', padding: '11px 12px', outline: 'none' }} /><button type="submit" disabled={busy || !input.trim()} aria-label={`Send message to ${MILES_ASSISTANT_NAME}`} style={sendButton}>{busy ? '…' : '↑'}</button></form>
      </section>
      <style>{`@keyframes miles-panel-in { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } } @media (max-width: 480px) { [role="dialog"] { width: calc(100vw - 24px) !important; right: 12px !important; bottom: calc(12px + env(safe-area-inset-bottom)) !important; } }`}</style>
    </div>
  );
}

const iconButton = { border: '1px solid rgba(255,255,255,.16)', borderRadius: 10, background: '#111413', color: '#fff', width: 32, height: 32, cursor: 'pointer' };
const confirmButton = { border: 'none', borderRadius: 10, background: '#f59e0b', color: '#172033', padding: '8px 12px', fontWeight: 700, cursor: 'pointer' };
const cancelButton = { border: '1px solid rgba(254,243,199,.35)', borderRadius: 10, background: 'transparent', color: '#fef3c7', padding: '8px 12px', cursor: 'pointer' };
const sendButton = { border: 'none', borderRadius: 14, background: 'linear-gradient(135deg,#2563eb,#4f46e5)', color: '#fff', width: 46, cursor: 'pointer', fontSize: 18 };

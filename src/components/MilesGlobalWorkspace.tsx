'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { MILES_ASSISTANT_NAME, MILES_ASSISTANT_SUBTITLE, MILES_MESSAGES } from '@/lib/ai/ui-config';

type MilesAttachment = { type: 'image'; url: string; thumbUrl?: string; name: string };
type Message = { role: 'user' | 'assistant'; content: string; attachments?: MilesAttachment[] };
type MediaItem = { kind: 'image' | 'video'; url: string; thumbnailUrl?: string; label: string; source: string; entityId?: string };
type Proposal = { actionId: string; confirmationPhrase: string; summary: string; highRisk?: boolean; expiresAt?: string; domain?: 'admin' | 'vendor' };

const initialMessage: Message = { role: 'assistant', content: `Hi. I’m ${MILES_ASSISTANT_NAME}. How can I help you with MasterCart today?` };

function safeText(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function MediaStrip({ items }: { items: MediaItem[] }) {
  if (!items.length) return null;
  return <div aria-label="Miles media results" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(118px,1fr))', gap: 8, marginTop: 10 }}>
    {items.map((item, index) => <figure key={`${item.url}-${index}`} style={{ margin: 0, borderRadius: 12, overflow: 'hidden', background: '#0b0d0c', border: '1px solid rgba(255,255,255,.1)' }}>
      {item.kind === 'video' ? <video controls preload="metadata" poster={item.thumbnailUrl} src={item.url} style={{ width: '100%', aspectRatio: '1.2', objectFit: 'cover', display: 'block' }} /> : <a href={item.url} target="_blank" rel="noreferrer"><img src={item.url} alt={item.label} loading="lazy" style={{ width: '100%', aspectRatio: '1.2', objectFit: 'cover', display: 'block' }} /></a>}
      <figcaption style={{ padding: '6px 7px', fontSize: 11, color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</figcaption>
    </figure>)}
  </div>;
}

export default function MilesGlobalWorkspace() {
  const pathname = usePathname();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<MilesAttachment | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [messages, setMessages] = useState<Message[]>([initialMessage]);

  useEffect(() => {
    const openPanel = () => { setOpen(true); setFull(false); };
    const openFull = () => { setOpen(true); setFull(true); };
    window.addEventListener('mastercart:miles-open', openPanel);
    window.addEventListener('mastercart:miles-full-open', openFull);
    return () => { window.removeEventListener('mastercart:miles-open', openPanel); window.removeEventListener('mastercart:miles-full-open', openFull); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); if (full) setFull(false); else setOpen(false); } };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, full]);

  async function handlePictureUpload(file: File) {
    if (!file.type.startsWith('image/')) { setMessages((previous) => [...previous, { role: 'assistant', content: 'Please upload an image file. Miles currently accepts pictures up to 5 MB.' }]); return; }
    setUploading(true);
    try {
      const { uploadFile } = await import('@/lib/storage');
      const { url, thumbUrl, error } = await uploadFile(file, 'brand-assets', `miles-upload-${Date.now()}`);
      if (error || !url) throw new Error(error || 'Image upload failed');
      setPendingAttachment({ type: 'image', url, thumbUrl: thumbUrl || undefined, name: file.name });
    } catch (error) {
      setMessages((previous) => [...previous, { role: 'assistant', content: error instanceof Error ? error.message : 'Miles could not upload that picture.' }]);
    } finally { setUploading(false); }
  }

  async function send() {
    const content = input.trim() || (pendingAttachment ? 'Please analyze the picture I uploaded and explain what you can identify.' : '');
    if (!content || busy || uploading) return;
    const nextMessage: Message = { role: 'user', content, ...(pendingAttachment ? { attachments: [pendingAttachment] } : {}) };
    const next = [...messages, nextMessage];
    setMessages(next); setInput(''); setPendingAttachment(null); setBusy(true); setMedia([]);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Miles session unavailable');
      const response = await fetch('/api/ai/copilot', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ messages: next, pathname, currentTab: 'overview' }) });
      if (!response.ok) throw new Error('Miles request failed');
      const data = await response.json() as { text?: unknown; proposal?: Proposal; domain?: 'admin' | 'vendor'; media?: MediaItem[] };
      if (data.proposal) setProposal({ ...data.proposal, domain: data.domain });
      setMedia(Array.isArray(data.media) ? data.media : []);
      setMessages([...next, { role: 'assistant', content: data.proposal?.summary || safeText(data.text, MILES_MESSAGES.unavailable) }]);
    } catch { setMessages([...next, { role: 'assistant', content: MILES_MESSAGES.unavailable }]); }
    finally { setBusy(false); }
  }

  async function confirmAction() {
    if (!proposal || busy) return;
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Miles session unavailable');
      const response = await fetch('/api/ai/actions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ domain: proposal.domain || 'vendor', mode: 'confirm', actionId: proposal.actionId, confirmation: proposal.confirmationPhrase }) });
      if (!response.ok) throw new Error('Action confirmation failed');
      const data = await response.json() as { result?: { summary?: unknown } };
      setMessages((previous) => [...previous, { role: 'assistant', content: safeText(data.result?.summary, MILES_MESSAGES.actionFailed) }]);
      if (data.result) setProposal(null);
    } catch { setMessages((previous) => [...previous, { role: 'assistant', content: MILES_MESSAGES.actionFailed }]); }
    finally { setBusy(false); }
  }

  const panelWidth = useMemo(() => full ? 'min(720px, calc(100vw - 24px))' : 'min(420px, calc(100vw - 24px))', [full]);
  if (!open) return null;
  const close = () => { setFull(false); setOpen(false); };
  const panelStyle = full ? { position: 'fixed' as const, inset: 0, width: '100vw', height: '100dvh', borderRadius: 0, background: '#000' } : { position: 'fixed' as const, right: 16, bottom: 'calc(16px + env(safe-area-inset-bottom))', width: panelWidth, maxHeight: 'min(720px, calc(100dvh - 32px))', borderRadius: 20, background: '#0b0d0c' };

  return <div role="presentation" onClick={(event) => event.stopPropagation()} style={{ position: 'fixed', inset: 0, zIndex: full ? 9999 : 1100, pointerEvents: 'none' }}>
    <section role="dialog" aria-modal={full} aria-label={`${MILES_ASSISTANT_NAME} ${full ? 'fullscreen' : 'chat'} assistant`} style={{ ...panelStyle, display: 'flex', flexDirection: 'column', overflow: 'hidden', pointerEvents: 'auto', color: '#fff', border: full ? 'none' : '1px solid rgba(255,255,255,.10)', boxShadow: full ? 'none' : '0 24px 70px rgba(0,0,0,.55)' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: full ? '18px max(18px, env(safe-area-inset-left))' : '14px 16px', borderBottom: '1px solid rgba(255,255,255,.10)', flexShrink: 0 }}>
        <div><strong style={{ fontSize: 18 }}>{MILES_ASSISTANT_NAME}</strong><div style={{ fontSize: 12, color: '#9ca3af', marginTop: 3 }}>{MILES_ASSISTANT_SUBTITLE}</div></div>
        <div style={{ display: 'flex', gap: 8 }}>{full && <button type="button" onClick={() => setFull(false)} aria-label={`Return to ${MILES_ASSISTANT_NAME} compact panel`} style={iconButton}>←</button>}{!full && <button type="button" onClick={() => setFull(true)} aria-label={`Open ${MILES_ASSISTANT_NAME} fullscreen`} style={iconButton}>□</button>}<button type="button" onClick={() => full ? setFull(false) : close()} aria-label={full ? `Minimize ${MILES_ASSISTANT_NAME}` : `Close ${MILES_ASSISTANT_NAME}`} style={iconButton}>{full ? '−' : '×'}</button></div>
      </header>
      <div style={{ flex: 1, minHeight: full ? 0 : 280, overflowY: 'auto', padding: full ? '24px max(18px, env(safe-area-inset-left))' : 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((message, index) => <div key={`${message.role}-${index}`} style={{ alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '92%', padding: '10px 12px', borderRadius: message.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', border: message.role === 'user' ? '1px solid rgba(0,211,154,.20)' : '1px solid rgba(255,255,255,.08)', background: message.role === 'user' ? 'rgba(0,211,154,.12)' : '#111413', whiteSpace: 'pre-wrap', lineHeight: 1.45, fontSize: 14 }}>{message.attachments?.map((attachment) => <img key={attachment.url} src={attachment.thumbUrl || attachment.url} alt={attachment.name} style={{ display: 'block', width: 180, maxWidth: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 10, marginBottom: 8 }} />)}{message.content}</div>)}
        {media.length > 0 && <div style={{ maxWidth: '100%' }}><div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>Relevant MasterCart media</div><MediaStrip items={media} /></div>}
        {busy && <div role="status" aria-live="polite" style={{ color: '#9ca3af', fontSize: 13 }}>{MILES_MESSAGES.thinking}</div>}
        {proposal && <div style={{ padding: 12, borderRadius: 16, border: '1px solid rgba(251,191,36,.5)', background: 'rgba(120,53,15,.28)' }}><div style={{ fontSize: 13, color: '#fde68a', marginBottom: 10 }}>Confirmation required</div><div style={{ fontSize: 13, marginBottom: 10 }}>{proposal.summary}</div><div style={{ display: 'flex', gap: 8 }}><button type="button" disabled={busy} onClick={confirmAction} style={confirmButton}>Confirm action</button><button type="button" disabled={busy} onClick={() => setProposal(null)} style={cancelButton}>Cancel</button></div></div>}
      </div>
      {pendingAttachment && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,.08)', color: '#cbd5e1', fontSize: 12 }}><img src={pendingAttachment.thumbUrl || pendingAttachment.url} alt="Selected upload" style={{ width: 42, height: 42, objectFit: 'cover', borderRadius: 8 }} /><span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pendingAttachment.name}</span><button type="button" onClick={() => setPendingAttachment(null)} style={cancelButton}>Remove</button></div>}
      <form onSubmit={(event) => { event.preventDefault(); send(); }} style={{ display: 'flex', gap: 8, padding: 14, paddingBottom: 'calc(14px + env(safe-area-inset-bottom))', borderTop: '1px solid rgba(255,255,255,.10)', flexShrink: 0 }}><input ref={fileInputRef} type="file" accept="image/*" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void handlePictureUpload(file); event.currentTarget.value = ''; }} /><button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy || uploading} aria-label="Upload a picture to Miles" style={iconButton}>{uploading ? '…' : '＋'}</button><input value={input} onChange={(event) => setInput(event.target.value)} placeholder={pendingAttachment ? 'Ask Miles to analyze this picture...' : `Ask ${MILES_ASSISTANT_NAME}...`} aria-label={`Ask ${MILES_ASSISTANT_NAME}`} autoComplete="off" style={{ flex: 1, minWidth: 0, border: '1px solid rgba(255,255,255,.12)', borderRadius: 14, background: '#111413', color: '#fff', padding: '11px 12px', outline: 'none' }} /><button type="submit" disabled={busy || uploading || (!input.trim() && !pendingAttachment)} aria-label={`Send message to ${MILES_ASSISTANT_NAME}`} style={sendButton}>{busy ? '…' : '↑'}</button></form>
    </section>
    <style>{`@media (max-width: 480px) { [role="dialog"] { width: calc(100vw - 24px) !important; right: 12px !important; bottom: calc(12px + env(safe-area-inset-bottom)) !important; }`}</style>
  </div>;
}

const iconButton = { border: '1px solid rgba(255,255,255,.16)', borderRadius: 10, background: '#111413', color: '#fff', width: 32, height: 32, cursor: 'pointer' };
const confirmButton = { border: 'none', borderRadius: 10, background: '#f59e0b', color: '#172033', padding: '8px 12px', fontWeight: 700, cursor: 'pointer' };
const cancelButton = { border: '1px solid rgba(254,243,199,.35)', borderRadius: 10, background: 'transparent', color: '#fef3c7', padding: '8px 12px', cursor: 'pointer' };
const sendButton = { border: 'none', borderRadius: 14, background: 'linear-gradient(135deg,#2563eb,#4f46e5)', color: '#fff', width: 46, cursor: 'pointer', fontSize: 18 };

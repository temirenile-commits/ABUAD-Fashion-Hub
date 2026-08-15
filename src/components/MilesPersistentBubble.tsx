'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { MILES_ASSISTANT_NAME } from '@/lib/ai/ui-config';

type Dock = 'free' | 'top' | 'top-left' | 'top-right' | 'left' | 'right' | 'bottom' | 'bottom-left' | 'bottom-right';
type Position = { x: number; y: number; dock: Dock };

type DragState = { pointerId: number; offsetX: number; offsetY: number; moved: boolean };

const POSITION_KEY = 'mastercart-miles-bubble-position-global';
const HIDDEN_KEY = 'mastercart-miles-bubble-hidden-global';
const BUBBLE_SIZE = 56;
const EDGE_GAP = 12;
const SNAP_DISTANCE = 48;
const SAFE_BOTTOM = 18;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

function viewportPosition(): Position {
  if (typeof window === 'undefined') return { x: 0, y: 0, dock: 'right' };
  return { x: Math.max(EDGE_GAP, window.innerWidth - BUBBLE_SIZE - EDGE_GAP), y: Math.max(EDGE_GAP, window.innerHeight - BUBBLE_SIZE - SAFE_BOTTOM), dock: 'right' };
}

function normalizePosition(saved: Partial<Position> | null): Position {
  const fallback = viewportPosition();
  if (!saved || typeof saved.x !== 'number' || typeof saved.y !== 'number') return fallback;
  return { x: saved.x, y: saved.y, dock: typeof saved.dock === 'string' ? saved.dock as Dock : 'free' };
}

function clampPosition(x: number, y: number): Position {
  if (typeof window === 'undefined') return { x, y, dock: 'free' };
  return {
    x: clamp(x, EDGE_GAP, Math.max(EDGE_GAP, window.innerWidth - BUBBLE_SIZE - EDGE_GAP)),
    y: clamp(y, EDGE_GAP, Math.max(EDGE_GAP, window.innerHeight - BUBBLE_SIZE - SAFE_BOTTOM)),
    dock: 'free',
  };
}

function snapPosition(position: Position): Position {
  if (typeof window === 'undefined') return position;
  const maxX = Math.max(EDGE_GAP, window.innerWidth - BUBBLE_SIZE - EDGE_GAP);
  const maxY = Math.max(EDGE_GAP, window.innerHeight - BUBBLE_SIZE - SAFE_BOTTOM);
  const x = clamp(position.x, EDGE_GAP, maxX);
  const y = clamp(position.y, EDGE_GAP, maxY);
  const candidates: Array<{ dock: Dock; x: number; y: number; distance: number }> = [
    { dock: 'left', x: EDGE_GAP, y, distance: x },
    { dock: 'right', x: maxX, y, distance: maxX - x },
    { dock: 'top', x, y: EDGE_GAP, distance: y },
    { dock: 'bottom', x, y: maxY, distance: maxY - y },
    { dock: 'top-left', x: EDGE_GAP, y: EDGE_GAP, distance: Math.hypot(x, y) },
    { dock: 'top-right', x: maxX, y: EDGE_GAP, distance: Math.hypot(maxX - x, y) },
    { dock: 'bottom-left', x: EDGE_GAP, y: maxY, distance: Math.hypot(x, maxY - y) },
    { dock: 'bottom-right', x: maxX, y: maxY, distance: Math.hypot(maxX - x, maxY - y) },
  ];
  const nearest = candidates.reduce((best, candidate) => candidate.distance < best.distance ? candidate : best);
  return nearest.distance <= SNAP_DISTANCE ? { x: nearest.x, y: nearest.y, dock: nearest.dock } : { x, y, dock: 'free' };
}

export default function MilesPersistentBubble() {
  const pathname = usePathname();
  const isReelsRoute = pathname === '/reels' || pathname.startsWith('/reels/');
  const [position, setPosition] = useState<Position>(() => {
    if (typeof window === 'undefined') return { x: 0, y: 0, dock: 'right' };
    try { return normalizePosition(JSON.parse(window.localStorage.getItem(POSITION_KEY) || 'null')); } catch { return viewportPosition(); }
  });
  const [hidden, setHidden] = useState(() => typeof window !== 'undefined' && window.localStorage.getItem(HIDDEN_KEY) === 'true');
  const [isAuthenticatedRole, setIsAuthenticatedRole] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const clickTimerRef = useRef<number | null>(null);

  useEffect(() => { try { window.localStorage.setItem(POSITION_KEY, JSON.stringify(position)); } catch {} }, [position]);
  useEffect(() => { try { window.localStorage.setItem(HIDDEN_KEY, String(hidden)); } catch {} }, [hidden]);

  useEffect(() => {
    let active = true;
    const resolveRole = async () => {
      setAuthResolved(false);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (active) { setIsAuthenticatedRole(false); setAuthResolved(true); } return; }
      const { data: profile } = await supabase.from('users').select('role, status').eq('id', user.id).maybeSingle();
      const role = profile?.role || user.user_metadata?.role || user.user_metadata?.user_type;
      if (active) { setIsAuthenticatedRole(profile?.status !== 'suspended' && profile?.status !== 'blocked' && Boolean(role)); setAuthResolved(true); }
    };
    resolveRole();
    const { data: listener } = supabase.auth.onAuthStateChange(resolveRole);
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const reposition = () => setPosition((current) => clampPosition(current.x, current.y));
    window.addEventListener('resize', reposition);
    return () => window.removeEventListener('resize', reposition);
  }, []);

  useEffect(() => () => { if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current); }, []);

  const openAssistant = () => window.dispatchEvent(new CustomEvent('mastercart:miles-open'));
  const openFullAssistant = () => window.dispatchEvent(new CustomEvent('mastercart:miles-full-open'));

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, moved: false };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.stopPropagation();
  };

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const next = clampPosition(event.clientX - drag.offsetX, event.clientY - drag.offsetY);
    if (Math.abs(next.x - position.x) > 2 || Math.abs(next.y - position.y) > 2) drag.moved = true;
    setPosition(next);
    event.preventDefault();
    event.stopPropagation();
  };

  const onPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    setPosition((current) => snapPosition(current));
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
    event.stopPropagation();
  };

  const onClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (dragRef.current?.moved) return;
    if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
    clickTimerRef.current = window.setTimeout(() => { clickTimerRef.current = null; openAssistant(); }, 220);
  };

  const onDoubleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
    clickTimerRef.current = null;
    openFullAssistant();
  };

  if (!authResolved || !isAuthenticatedRole) return null;

  const style = {
    position: 'fixed' as const,
    left: `${position.x}px`,
    top: `${position.y}px`,
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    zIndex: 1000,
    touchAction: 'none' as const,
    userSelect: 'none' as const,
    border: '1px solid rgba(255,255,255,.28)',
    borderRadius: '50%',
    background: isReelsRoute ? 'linear-gradient(135deg,rgba(37,99,235,.72),rgba(79,70,229,.72))' : 'linear-gradient(135deg,#2563eb,#4f46e5)',
    color: '#fff',
    fontSize: '1.05rem',
    fontWeight: 800,
    letterSpacing: '.02em',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: dragging ? 'grabbing' : 'grab',
    opacity: isReelsRoute ? .78 : 1,
    backdropFilter: isReelsRoute ? 'blur(6px)' : 'none',
    WebkitBackdropFilter: isReelsRoute ? 'blur(6px)' : 'none',
    boxShadow: isReelsRoute ? '0 8px 22px rgba(0,0,0,.24),0 0 14px rgba(37,99,235,.16)' : '0 10px 30px rgba(0,0,0,.35),0 0 20px rgba(37,99,235,.20)',
    transition: dragging ? 'none' : 'left 220ms ease, top 220ms ease, transform 160ms ease, opacity 160ms ease, box-shadow 160ms ease',
  };

  if (hidden) return <button className="miles-bubble" type="button" aria-label={`Show ${MILES_ASSISTANT_NAME} assistant`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); setHidden(false); }} style={{ ...style, width: 22, borderRadius: position.x < window.innerWidth / 2 ? '0 12px 12px 0' : '12px 0 0 12px', fontSize: '.78rem' }}>M</button>;

  return <>
    <button className="miles-bubble" type="button" aria-label={`Open ${MILES_ASSISTANT_NAME} AI assistant`} title={`Drag ${MILES_ASSISTANT_NAME} or tap to open`} onClick={onClick} onDoubleClick={onDoubleClick} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} style={style}>M</button>
    <style>{`.miles-bubble:hover,.miles-bubble:focus-visible{transform:scale(1.06);outline:2px solid rgba(255,255,255,.72);outline-offset:2px}.miles-bubble:active{transform:scale(.96)}`}</style>
  </>;
}

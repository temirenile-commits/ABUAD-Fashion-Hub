'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const POSITION_KEY = 'mastercart-miles-bubble-position-global';
const HIDDEN_KEY = 'mastercart-miles-bubble-hidden-global';
type Side = 'left' | 'right';
type BubblePosition = { side: Side; top: number | null };

const vendorAccountRoutes = [
  '/dashboard/vendor',
  '/dashboard/delicacies',
  '/dashboard/support',
  '/dashboard/vendor/pay-fee',
  '/dashboard/delicacies/pay-fee',
  '/reels',
  '/services',
  '/messages',
  '/notifications',
  '/settings',
  '/wishlist',
  '/onboarding',
];

function isVendorRoute(pathname: string) {
  return vendorAccountRoutes.some(route => pathname === route || pathname.startsWith(`${route}/`));
}

function clampTop(top: number) {
  if (typeof window === 'undefined') return top;
  return Math.max(12, Math.min(top, Math.max(12, window.innerHeight - 86)));
}

export default function MilesPersistentBubble() {
  const pathname = usePathname();
  const [position, setPosition] = useState<BubblePosition>({ side: 'right', top: null });
  const [hidden, setHidden] = useState(false);
  const [isVendor, setIsVendor] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);
  const draggedRef = useRef(false);

  const accountPage = isVendorRoute(pathname);

  useEffect(() => {
    try {
      const savedPosition = JSON.parse(window.localStorage.getItem(POSITION_KEY) || 'null') as Partial<BubblePosition> | null;
      if (savedPosition?.side === 'left' || savedPosition?.side === 'right') {
        setPosition({ side: savedPosition.side, top: typeof savedPosition.top === 'number' ? savedPosition.top : null });
      }
      if (window.localStorage.getItem(HIDDEN_KEY) === 'true') setHidden(true);
    } catch {}
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(POSITION_KEY, JSON.stringify(position)); } catch {}
  }, [position]);

  useEffect(() => {
    try { window.localStorage.setItem(HIDDEN_KEY, String(hidden)); } catch {}
  }, [hidden]);

  useEffect(() => {
    let active = true;
    const resolveVendor = async () => {
      setAuthResolved(false);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (active) { setIsVendor(false); setAuthResolved(true); }
        return;
      }
      const { data: brand } = await supabase.from('brands').select('id').eq('owner_id', user.id).limit(1).maybeSingle();
      const metadataVendor = user.user_metadata?.role === 'vendor' || user.user_metadata?.user_type === 'vendor';
      if (active) { setIsVendor(Boolean(brand || metadataVendor)); setAuthResolved(true); }
    };
    resolveVendor();
    const { data: listener } = supabase.auth.onAuthStateChange(() => { resolveVendor(); });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [pathname]);

  const openAssistant = () => {
    window.dispatchEvent(new CustomEvent('mastercart:miles-open'));
    if (pathname !== '/dashboard/vendor' && pathname !== '/dashboard/delicacies') {
      window.location.href = '/dashboard/vendor?miles=open';
    }
  };

  const openFullAssistant = () => {
    window.dispatchEvent(new CustomEvent('mastercart:miles-full-open'));
    if (pathname !== '/dashboard/vendor' && pathname !== '/dashboard/delicacies') {
      window.location.href = '/dashboard/vendor?miles=open&full=1';
    }
  };

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
    draggedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    const moved = Math.abs(event.movementX) + Math.abs(event.movementY) > 2;
    if (moved) draggedRef.current = true;
    const nextSide: Side = event.clientX < window.innerWidth / 2 ? 'left' : 'right';
    setPosition({ side: nextSide, top: clampTop(event.clientY - dragRef.current.offsetY) });
    event.preventDefault();
  };

  const onPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
    window.setTimeout(() => { draggedRef.current = false; }, 0);
  };

  if (!authResolved || !accountPage || !isVendor) return null;

  const dockStyle = position.top === null
    ? { bottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }
    : { top: `${clampTop(position.top)}px` };

  if (hidden) {
    return (
      <button
        type="button"
        aria-label="Show Miles assistant"
        onClick={() => setHidden(false)}
        style={{
          position: 'fixed',
          ...dockStyle,
          [position.side]: 0,
          zIndex: 10001,
          border: '1px solid rgba(34,211,238,0.5)',
          borderRight: position.side === 'left' ? '1px solid rgba(34,211,238,0.5)' : 'none',
          borderLeft: position.side === 'right' ? '1px solid rgba(34,211,238,0.5)' : 'none',
          borderRadius: position.side === 'left' ? '0 14px 14px 0' : '14px 0 0 14px',
          background: 'linear-gradient(180deg, #0F766E, #312E81)',
          color: '#ECFEFF',
          padding: '0.7rem 0.45rem',
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(8,47,73,0.45)',
        }}
      >✦</button>
    );
  }

  return (
    <button
      type="button"
      aria-label="Open Miles assistant"
      title="Drag Miles or tap to open"
      onClick={() => { if (!draggedRef.current) openAssistant(); }}
      onDoubleClick={openFullAssistant}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: 'fixed',
        ...dockStyle,
        left: position.side === 'left' ? '1.5rem' : 'auto',
        right: position.side === 'right' ? '1.5rem' : 'auto',
        width: 58,
        height: 58,
        zIndex: 10001,
        touchAction: 'none',
        userSelect: 'none',
        border: '1px solid rgba(103,232,249,0.65)',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #0F766E 0%, #2563EB 48%, #7C3AED 100%)',
        color: '#F0FDFA',
        fontSize: '1.35rem',
        cursor: 'grab',
        boxShadow: '0 10px 34px rgba(37,99,235,0.38), 0 0 0 4px rgba(34,211,238,0.08)',
        transition: dragRef.current ? 'none' : 'transform 160ms ease, box-shadow 160ms ease',
      }}
      onMouseEnter={event => { event.currentTarget.style.transform = 'scale(1.06)'; }}
      onMouseLeave={event => { event.currentTarget.style.transform = 'scale(1)'; }}
    >
      ✦
    </button>
  );
}

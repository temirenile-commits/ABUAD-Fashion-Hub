'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const SIDE_KEY = 'mastercart-miles-bubble-side-global';
const HIDDEN_KEY = 'mastercart-miles-bubble-hidden-global';

type Side = 'left' | 'right';

export default function MilesPersistentBubble() {
  const pathname = usePathname();
  const [side, setSide] = useState<Side>('right');
  const [hidden, setHidden] = useState(false);
  const [isVendor, setIsVendor] = useState(false);

  const vendorAccountRoutes = ['/dashboard/vendor', '/dashboard/delicacies', '/reels', '/services', '/messages', '/notifications', '/settings', '/explore'];
  const isVendorAccountPage = vendorAccountRoutes.some(route => pathname === route || pathname.startsWith(`${route}/`));

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: brand } = await supabase.from('brands').select('id').eq('owner_id', user.id).limit(1).maybeSingle();
      if (active) setIsVendor(Boolean(brand));
    })();
    return () => { active = false; };
  }, [pathname]);

  useEffect(() => {
    try {
      const savedSide = window.localStorage.getItem(SIDE_KEY);
      const savedHidden = window.localStorage.getItem(HIDDEN_KEY);
      if (savedSide === 'left' || savedSide === 'right') setSide(savedSide);
      if (savedHidden === 'true') setHidden(true);
    } catch {}
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(SIDE_KEY, side); } catch {}
  }, [side]);

  useEffect(() => {
    try { window.localStorage.setItem(HIDDEN_KEY, String(hidden)); } catch {}
  }, [hidden]);

  if (!isVendorAccountPage || !isVendor) return null;

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
  const snapToSide = (event: React.DragEvent<HTMLButtonElement>) => {
    setSide(event.clientX < window.innerWidth / 2 ? 'left' : 'right');
  };

  if (hidden) {
    return (
      <button
        type="button"
        aria-label="Show Miles assistant"
        onClick={() => setHidden(false)}
        style={{
          position: 'fixed',
          top: '42%',
          [side]: 0,
          zIndex: 10001,
          border: '1px solid rgba(34,211,238,0.5)',
          borderRight: side === 'left' ? '1px solid rgba(34,211,238,0.5)' : 'none',
          borderLeft: side === 'right' ? '1px solid rgba(34,211,238,0.5)' : 'none',
          borderRadius: side === 'left' ? '0 14px 14px 0' : '14px 0 0 14px',
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
      title="Open Miles assistant"
      draggable
      onClick={openAssistant}
      onDragEnd={snapToSide}
      style={{
        position: 'fixed',
        bottom: 'calc(1.5rem + env(safe-area-inset-bottom))',
        left: side === 'left' ? '1.5rem' : 'auto',
        right: side === 'right' ? '1.5rem' : 'auto',
        width: 58,
        height: 58,
        zIndex: 10001,
        border: '1px solid rgba(103,232,249,0.65)',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #0F766E 0%, #2563EB 48%, #7C3AED 100%)',
        color: '#F0FDFA',
        fontSize: '1.35rem',
        cursor: 'grab',
        boxShadow: '0 10px 34px rgba(37,99,235,0.38), 0 0 0 4px rgba(34,211,238,0.08)',
        transition: 'transform 160ms ease, box-shadow 160ms ease',
      }}
      onDoubleClick={openFullAssistant}
      onMouseEnter={event => { event.currentTarget.style.transform = 'scale(1.06)'; }}
      onMouseLeave={event => { event.currentTarget.style.transform = 'scale(1)'; }}
    >
      ✦
    </button>
  );
}

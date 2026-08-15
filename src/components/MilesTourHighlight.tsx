'use client';

import type { CSSProperties } from 'react';

type Rect = { top: number; left: number; width: number; height: number };

export default function MilesTourHighlight({ rect, active }: { rect: Rect | null; active: boolean }) {
  if (!active) return null;

  if (!rect) {
    return <div className="miles-tour-scrim" aria-hidden="true" />;
  }

  const style: CSSProperties = {
    position: 'fixed',
    top: Math.max(4, rect.top - 7),
    left: Math.max(4, rect.left - 7),
    width: rect.width + 14,
    height: rect.height + 14,
    zIndex: 1001,
    pointerEvents: 'none',
    border: '2px solid rgba(147,197,253,.98)',
    borderRadius: 12,
    boxShadow: '0 0 0 100vmax rgba(15,23,42,.28), 0 0 0 8px rgba(96,165,250,.16), 0 0 30px rgba(96,165,250,.58)',
    transition: 'top 180ms cubic-bezier(.23,1,.32,1), left 180ms cubic-bezier(.23,1,.32,1), width 180ms cubic-bezier(.23,1,.32,1), height 180ms cubic-bezier(.23,1,.32,1)',
  };

  return <div className="miles-tour-highlight" style={style} aria-hidden="true" />;
}

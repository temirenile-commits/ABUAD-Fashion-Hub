'use client';

import type { CSSProperties } from 'react';

const REFERENCE_ASSET = '/branding/miles-ai-reference.png';

type MilesVisualIdentityProps = {
  initial: string;
  name: string;
  size?: number;
  avatar?: string | null;
  className?: string;
  compact?: boolean;
  label?: string;
};

export default function MilesVisualIdentity({
  initial,
  name,
  size = 56,
  avatar,
  className = '',
  compact = false,
  label,
}: MilesVisualIdentityProps) {
  const safeInitial = (initial || name?.charAt(0) || 'M').trim().charAt(0).toUpperCase() || 'M';
  const imageSource = avatar || REFERENCE_ASSET;
  const style = { '--miles-size': `${size}px` } as CSSProperties;

  return (
    <span className={`miles-visual-identity ${compact ? 'miles-visual-identity-compact' : ''} ${className}`} role="img" aria-label={label || `${name} profile picture`} style={{ ...style, width: size, height: size, minWidth: size }}>
      <img className="miles-visual-identity-image" src={imageSource} alt="" aria-hidden="true" draggable={false} />
      <span className="miles-visual-identity-mask" aria-hidden="true" />
      <span className="miles-visual-identity-letter" aria-hidden="true">{safeInitial}</span>
      <style>{`
        .miles-visual-identity{position:relative;display:inline-grid;place-items:center;flex:0 0 var(--miles-size);overflow:hidden;border-radius:50%;isolation:isolate;background:#02060d;border:1px solid rgba(214,255,247,.78);box-shadow:0 0 0 1px rgba(21,255,199,.24),0 5px 16px rgba(0,0,0,.34),0 0 18px rgba(21,255,199,.3)}
        .miles-visual-identity::before{content:"";position:absolute;inset:-14%;z-index:-2;border-radius:50%;background:radial-gradient(circle,rgba(21,255,199,.42) 0%,rgba(24,182,163,.2) 42%,transparent 72%);filter:blur(6px);animation:miles-visual-breathe 4.2s ease-in-out infinite}
        .miles-visual-identity-image{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center top;transform:scale(1.36);transform-origin:center top;user-select:none;pointer-events:none}
        .miles-visual-identity-mask{position:absolute;inset:20%;z-index:1;border-radius:50%;background:radial-gradient(circle at 36% 27%,rgba(20,35,39,.92) 0%,rgba(2,8,14,.96) 58%,rgba(0,0,0,.8) 100%);box-shadow:inset 0 0 14px rgba(0,0,0,.72);pointer-events:none}
        .miles-visual-identity-letter{position:relative;z-index:2;display:inline-block;color:#47ffd0;font-family:"Brush Script MT","Segoe Script","URW Chancery L",cursive;font-style:italic;font-weight:700;font-size:calc(var(--miles-size) * .62);line-height:1;letter-spacing:-.06em;transform:translate(-2%,-4%) rotate(-8deg);text-shadow:1px 2px 0 rgba(0,0,0,.38),0 0 8px rgba(70,255,208,.72);pointer-events:none}
        .miles-visual-identity-compact .miles-visual-identity-mask{inset:22%}
        .miles-visual-identity-compact .miles-visual-identity-letter{font-size:calc(var(--miles-size) * .66)}
        @keyframes miles-visual-breathe{0%,100%{transform:scale(.92);opacity:.52}50%{transform:scale(1.08);opacity:.9}}
        @media (prefers-reduced-motion:reduce){.miles-visual-identity::before{animation:none}}
      `}</style>
    </span>
  );
}

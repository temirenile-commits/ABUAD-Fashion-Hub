'use client';

import { useEffect, useRef } from 'react';
import MilesProfileAvatar from './MilesProfileAvatar';
import { useMilesConfiguration } from '@/components/MilesConfigurationProvider';

type Rect = { top: number; left: number; width: number; height: number };
type Side = 'top' | 'bottom' | 'left' | 'right';

type Props = {
  rect: Rect | null;
  title: string;
  message: string;
  stepLabel?: string;
  side?: Side;
  waiting?: boolean;
  isPaused?: boolean;
  isLast?: boolean;
  onSkip: () => void;
  onPause: () => void;
  onBack: () => void;
  onNext: () => void;
  onResume?: () => void;
  canGoBack?: boolean;
  resumePrompt?: boolean;
};

function getPosition(rect: Rect | null, side: Side = 'bottom') {
  if (typeof window === 'undefined' || !rect) return { left: '50%', top: '50%', transform: 'translate(-50%,-50%)' };
  const width = Math.min(380, window.innerWidth - 28);
  const height = 250;
  const gap = 18;
  const candidates = side === 'top'
    ? [{ left: rect.left + rect.width / 2 - width / 2, top: rect.top - height - gap }, { left: rect.left + rect.width / 2 - width / 2, top: rect.top + rect.height + gap }]
    : side === 'left'
      ? [{ left: rect.left - width - gap, top: rect.top + rect.height / 2 - height / 2 }, { left: rect.left + rect.width + gap, top: rect.top + rect.height / 2 - height / 2 }]
      : side === 'right'
        ? [{ left: rect.left + rect.width + gap, top: rect.top + rect.height / 2 - height / 2 }, { left: rect.left - width - gap, top: rect.top + rect.height / 2 - height / 2 }]
        : [{ left: rect.left + rect.width / 2 - width / 2, top: rect.top + rect.height + gap }, { left: rect.left + rect.width / 2 - width / 2, top: rect.top - height - gap }];
  const safe = candidates.find((candidate) => candidate.left >= 14 && candidate.left + width <= window.innerWidth - 14 && candidate.top >= 14 && candidate.top + height <= window.innerHeight - 14)
    || { left: Math.max(14, (window.innerWidth - width) / 2), top: Math.max(14, window.innerHeight - height - 20) };
  return { left: safe.left, top: safe.top };
}

export default function MilesTourBubble({ rect, title, message, stepLabel, side, waiting, isPaused, isLast, onSkip, onPause, onBack, onNext, onResume, canGoBack = false, resumePrompt = false }: Props) {
  const panelRef = useRef<HTMLElement>(null);
  const { configuration } = useMilesConfiguration();
  const assistantName = configuration.identity.name;
  useEffect(() => { panelRef.current?.focus(); }, [title, message, waiting, resumePrompt]);
  const style = getPosition(rect, side);

  return (
    <section ref={panelRef} tabIndex={-1} className="miles-tour-bubble" style={style} role="dialog" aria-modal="false" aria-labelledby="miles-tour-title" aria-describedby="miles-tour-message">
      <style>{`
        .miles-tour-bubble{position:fixed;z-index:1002;width:min(380px,calc(100vw - 28px));box-sizing:border-box;padding:16px 17px;border:1px solid rgba(255,255,255,.18);border-radius:22px;background:linear-gradient(145deg,rgba(7,10,18,.98),rgba(24,31,51,.96));box-shadow:0 24px 70px rgba(0,0,0,.42),0 0 28px rgba(96,165,250,.2);color:#f8fafc;animation:miles-tour-enter .22s cubic-bezier(.23,1,.32,1);outline:none}
        .miles-tour-head{display:flex;align-items:center;gap:9px}.miles-tour-head strong{display:block;font-size:.98rem}.miles-tour-head span{display:block;color:#a7b4c7;font-size:.72rem}.miles-tour-close{margin-left:auto;border:0;background:transparent;color:#cbd5e1;font-size:1.45rem;line-height:1;cursor:pointer;padding:4px}.miles-tour-label{margin:13px 0 5px;color:#93c5fd;font-size:.68rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.miles-tour-bubble h2{margin:0;font-size:1.08rem;line-height:1.25}.miles-tour-message{margin:8px 0 15px;color:#dbe4f0;font-size:.88rem;line-height:1.5}.miles-tour-actions{display:flex;align-items:center;justify-content:space-between;gap:8px}.miles-tour-actions>div{display:flex;gap:7px}.miles-tour-button{border:1px solid rgba(255,255,255,.16);border-radius:999px;padding:8px 11px;font-size:.76rem;font-weight:750;cursor:pointer;transition:transform 150ms ease,background 150ms ease}.miles-tour-button:active{transform:scale(.97)}.miles-tour-button:focus-visible{outline:2px solid #bfdbfe;outline-offset:2px}.miles-tour-button.secondary{background:rgba(255,255,255,.08);color:#e2e8f0}.miles-tour-button.primary{background:linear-gradient(135deg,#93c5fd,#818cf8);color:#101827}.miles-tour-button:disabled{opacity:.42;cursor:not-allowed}.miles-tour-resume{display:flex;gap:8px;flex-wrap:wrap}.miles-tour-resume .miles-tour-button{flex:1;min-width:110px}.miles-tour-scrim{position:fixed;inset:0;z-index:998;pointer-events:none;background:rgba(15,23,42,.2)}.miles-tour-highlight{will-change:top,left,width,height}.miles-tour-bubble button{font-family:inherit}@keyframes miles-tour-enter{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}@media(max-width:640px){.miles-tour-bubble{left:14px!important;right:14px;width:auto;top:auto!important;bottom:max(14px,env(safe-area-inset-bottom));transform:none!important}.miles-tour-actions{align-items:stretch;flex-direction:column}.miles-tour-actions>div{justify-content:space-between}.miles-tour-button{min-height:40px}}@media(prefers-reduced-motion:reduce){.miles-tour-bubble{animation:none}.miles-tour-button{transition:none}.miles-tour-highlight{transition:none!important}}
      `}</style>
      <div className="miles-tour-head"><MilesProfileAvatar size={34} /><div><strong>{assistantName}</strong><span>{resumePrompt ? `Your ${assistantName} tour is ready to resume` : `Your MasterCart ${assistantName} guide`}</span></div><button className="miles-tour-close" type="button" onClick={onSkip} aria-label={`Exit ${assistantName} tour`}>×</button></div>
      {stepLabel && !resumePrompt && <p className="miles-tour-label">{stepLabel}</p>}
      <h2 id="miles-tour-title">{title}</h2>
      <p id="miles-tour-message" className="miles-tour-message">{message}</p>
      {resumePrompt ? <div className="miles-tour-resume"><button className="miles-tour-button primary" type="button" onClick={onResume}>Resume tour</button><button className="miles-tour-button secondary" type="button" onClick={onNext}>Start over</button><button className="miles-tour-button secondary" type="button" onClick={onSkip}>Not now</button></div> : !waiting && <div className="miles-tour-actions"><button className="miles-tour-button secondary" type="button" onClick={onSkip}>Skip</button><div><button className="miles-tour-button secondary" type="button" onClick={onBack} disabled={!canGoBack}>Previous</button><button className="miles-tour-button secondary" type="button" onClick={onPause}>{isPaused ? 'Resume' : 'Pause'}</button><button className="miles-tour-button primary" type="button" onClick={onNext}>{isLast ? 'Finish' : 'Next'}</button></div></div>}
    </section>
  );
}

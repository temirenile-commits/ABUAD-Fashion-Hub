'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import MilesProfileAvatar from './MilesProfileAvatar';
import { getOnboardingForRole, getPublicOnboarding, MILES_ONBOARDING_VERSION, type MilesOnboardingStep } from '@/lib/miles/onboarding';
import { supabase } from '@/lib/supabase';

const GUEST_KEY = 'mastercart-miles-public-onboarding-v1';
const PROGRESS_EVENT = 'mastercart:miles-onboarding-start';

type RemoteState = {
  authenticated: boolean;
  mode: 'public' | 'authenticated';
  role?: string;
  roles?: string[];
  capabilities?: string[];
  permissions?: string[];
  progress?: {
    onboarding_version: number;
    onboarding_started: boolean;
    current_step: number;
    completed: boolean;
    skipped: boolean;
  } | null;
};

type Rect = { top: number; left: number; width: number; height: number };

export default function MilesOnboarding() {
  const pathname = usePathname();
  const router = useRouter();
  const [remote, setRemote] = useState<RemoteState | null>(null);
  const [steps, setSteps] = useState<MilesOnboardingStep[]>([]);
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const targetRef = useRef<Element | null>(null);

  const isPublic = remote?.authenticated === false;
  const currentStep = steps[stepIndex];
  const waiting = Boolean(active && currentStep && pathname !== currentStep.route);
  const isLast = Boolean(currentStep && stepIndex >= steps.length - 1);

  const persist = useCallback(async (nextIndex: number, changes: Record<string, boolean | number | string> = {}) => {
    if (isPublic) {
      try { window.localStorage.setItem(GUEST_KEY, JSON.stringify({ currentStep: nextIndex, lastSeen: new Date().toISOString(), ...changes })); } catch {}
      return;
    }
    try {
      await fetch('/api/onboarding/miles', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ roleKey: remote?.role || 'customer', onboardingVersion: MILES_ONBOARDING_VERSION, onboardingStarted: true, currentStep: nextIndex, ...changes }),
      });
    } catch {}
  }, [isPublic, remote]);

  const start = useCallback((requestedMode?: 'public' | 'authenticated', requestedStep = 0) => {
    const mode = requestedMode || (remote?.authenticated ? 'authenticated' : 'public');
    const nextSteps = mode === 'public' ? getPublicOnboarding() : getOnboardingForRole(remote?.role || 'customer', { capabilities: remote?.capabilities || [], roles: remote?.roles || [] });
    setSteps(nextSteps);
    setStepIndex(Math.min(requestedStep, Math.max(0, nextSteps.length - 1)));
    setActive(true);
    void persist(requestedStep, { onboardingStarted: true, completed: false, skipped: false });
  }, [persist, remote?.authenticated, remote?.capabilities, remote?.role, remote?.roles]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch('/api/onboarding/miles', { cache: 'no-store' });
        const data = await response.json() as RemoteState;
        if (cancelled) return;
        setRemote(data);
        if (data.authenticated) {
          const progress = data.progress;
          if (!progress || progress.onboarding_version !== MILES_ONBOARDING_VERSION || (!progress.completed && !progress.skipped)) {
            const nextSteps = getOnboardingForRole(data.role || 'customer', { capabilities: data.capabilities || [], roles: data.roles || [] });
            setSteps(nextSteps);
            setStepIndex(progress?.onboarding_version === MILES_ONBOARDING_VERSION ? progress.current_step : 0);
            window.setTimeout(() => !cancelled && setActive(true), 700);
          }
        } else {
          let guestState: { currentStep?: number; completed?: boolean; skipped?: boolean } = {};
          try { guestState = JSON.parse(window.localStorage.getItem(GUEST_KEY) || '{}'); } catch {}
          if (!guestState.completed && !guestState.skipped) {
            const nextSteps = getPublicOnboarding();
            setSteps(nextSteps);
            setStepIndex(Math.min(guestState.currentStep || 0, nextSteps.length - 1));
            window.setTimeout(() => !cancelled && setActive(true), 900);
          }
        }
      } catch {
        if (!cancelled) setRemote({ authenticated: false, mode: 'public' });
      }
    };
    void load();
    const { data: authListener } = supabase.auth.onAuthStateChange(() => { void load(); });
    return () => { cancelled = true; authListener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const handleRestart = (event: Event) => {
      const detail = (event as CustomEvent<{ mode?: 'public' | 'authenticated' }>).detail;
      start(detail?.mode);
    };
    const handleEnd = () => setActive(false);
    window.addEventListener(PROGRESS_EVENT, handleRestart);
    window.addEventListener('mastercart:miles-onboarding-end', handleEnd);
    return () => {
      window.removeEventListener(PROGRESS_EVENT, handleRestart);
      window.removeEventListener('mastercart:miles-onboarding-end', handleEnd);
    };
  }, [start]);

  useEffect(() => {
    if (!active || !currentStep) return;
    if (pathname !== currentStep.route) router.push(currentStep.route);
  }, [active, currentStep, pathname, router]);

  useEffect(() => {
    if (!active || !currentStep || waiting || pathname !== currentStep.route) return;
    let frame = 0;
    let attempts = 0;
    const locate = () => {
      const target = currentStep.target ? document.querySelector(currentStep.target) : null;
      if (target) {
        targetRef.current = target;
        const rect = target.getBoundingClientRect();
        setTargetRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
        target.classList.add('miles-onboarding-target');
        return;
      }
      if (currentStep.target && attempts < 12) {
        attempts += 1;
        frame = window.requestAnimationFrame(locate);
        return;
      }
      targetRef.current = null;
      setTargetRect(null);
    };
    locate();
    const update = () => {
      const target = targetRef.current;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      setTargetRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    };
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.cancelAnimationFrame(frame);
      targetRef.current?.classList.remove('miles-onboarding-target');
      targetRef.current = null;
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [active, currentStep, pathname, waiting]);

  useEffect(() => {
    if (!active || !currentStep) return;
    void persist(stepIndex, { onboardingStarted: true });
  }, [active, currentStep, persist, stepIndex]);

  const close = useCallback((status: 'completed' | 'skipped') => {
    setActive(false);
    setTargetRect(null);
    void persist(stepIndex, { [status]: true, completed: status === 'completed', skipped: status === 'skipped' });
  }, [persist, stepIndex]);

  const next = () => {
    if (isLast) { close('completed'); return; }
    const nextIndex = stepIndex + 1;
    setStepIndex(nextIndex);
    void persist(nextIndex, { onboardingStarted: true });
  };
  const back = () => { if (stepIndex > 0) setStepIndex((value) => value - 1); };

  const cardStyle = useMemo<React.CSSProperties>(() => {
    if (typeof window === 'undefined' || !targetRect || !currentStep) return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
    const gap = 18;
    const width = Math.min(380, window.innerWidth - 28);
    const height = 230;
    const preferred = currentStep.side || 'bottom';
    const candidates = preferred === 'top' ? [{ left: targetRect.left + targetRect.width / 2 - width / 2, top: targetRect.top - height - gap }, { left: targetRect.left + targetRect.width / 2 - width / 2, top: targetRect.top + targetRect.height + gap }]
      : preferred === 'left' ? [{ left: targetRect.left - width - gap, top: targetRect.top + targetRect.height / 2 - height / 2 }, { left: targetRect.left + targetRect.width + gap, top: targetRect.top + targetRect.height / 2 - height / 2 }]
      : preferred === 'right' ? [{ left: targetRect.left + targetRect.width + gap, top: targetRect.top + targetRect.height / 2 - height / 2 }, { left: targetRect.left - width - gap, top: targetRect.top + targetRect.height / 2 - height / 2 }]
      : [{ left: targetRect.left + targetRect.width / 2 - width / 2, top: targetRect.top + targetRect.height + gap }, { left: targetRect.left + targetRect.width / 2 - width / 2, top: targetRect.top - height - gap }];
    const safe = candidates.find((candidate) => candidate.left >= 14 && candidate.left + width <= window.innerWidth - 14 && candidate.top >= 72 && candidate.top + height <= window.innerHeight - 18) || { left: Math.max(14, (window.innerWidth - width) / 2), top: Math.max(78, window.innerHeight - height - 22) };
    return { left: safe.left, top: safe.top };
  }, [currentStep, targetRect]);

  if (!active || !currentStep || !remote) return null;

  return (
    <>
      <div className="miles-onboarding-scrim" aria-hidden="true" />
      <section className="miles-onboarding-card" style={cardStyle} role="dialog" aria-modal="false" aria-labelledby="miles-onboarding-title" aria-describedby="miles-onboarding-message" onKeyDown={(event) => { if (event.key === 'Escape') close('skipped'); }}>
        <div className="miles-onboarding-header"><MilesProfileAvatar size={36} /><div><strong>Miles</strong><span>{isPublic ? 'Your MasterCart guide' : 'Your guided tour'}</span></div><button type="button" className="miles-onboarding-close" onClick={() => close('skipped')} aria-label="Skip Miles onboarding">×</button></div>
        {waiting ? <p id="miles-onboarding-message" className="miles-onboarding-message">Let’s take a look at this section…</p> : <><p className="miles-onboarding-progress">Step {stepIndex + 1} of {steps.length}</p><h2 id="miles-onboarding-title">{currentStep.title}</h2><p id="miles-onboarding-message" className="miles-onboarding-message">{currentStep.message}</p></>}
        {!waiting && <div className="miles-onboarding-actions"><button type="button" className="miles-onboarding-secondary" onClick={() => close('skipped')}>Skip</button><div><button type="button" className="miles-onboarding-secondary" onClick={back} disabled={stepIndex === 0}>Back</button><button type="button" className="miles-onboarding-primary" onClick={next}>{isLast ? 'Finish' : 'Next'}</button></div></div>}
        {isPublic && !waiting && stepIndex === 0 && <div className="miles-onboarding-entry"><button type="button" onClick={() => router.push('/auth/register')}>Create account</button><button type="button" onClick={() => router.push('/auth/login')}>Log in</button><button type="button" onClick={next}>Explore first</button></div>}
      </section>
      <style>{`
        .miles-onboarding-scrim{position:fixed;inset:0;z-index:998;background:rgba(15,23,42,.16);pointer-events:none;}
        .miles-onboarding-card{position:fixed;z-index:1002;width:min(380px,calc(100vw - 28px));box-sizing:border-box;padding:18px;border:1px solid rgba(255,255,255,.24);border-radius:24px;background:linear-gradient(145deg,rgba(15,23,42,.96),rgba(30,41,90,.95));box-shadow:0 24px 70px rgba(15,23,42,.38),0 0 34px rgba(96,165,250,.22);color:#f8fafc;animation:miles-onboarding-in .24s ease-out;}
        .miles-onboarding-header{display:flex;align-items:center;gap:10px}.miles-onboarding-header strong{display:block;font-size:1rem}.miles-onboarding-header span{display:block;color:#cbd5e1;font-size:.75rem}.miles-onboarding-close{margin-left:auto;border:0;background:transparent;color:#cbd5e1;font-size:1.5rem;line-height:1;cursor:pointer}.miles-onboarding-progress{margin:16px 0 6px;color:#93c5fd;font-size:.74rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em}.miles-onboarding-card h2{margin:0;font-size:1.18rem}.miles-onboarding-message{margin:10px 0 18px;line-height:1.55;color:#e2e8f0;font-size:.93rem}.miles-onboarding-actions{display:flex;justify-content:space-between;align-items:center;gap:10px}.miles-onboarding-actions>div{display:flex;gap:8px}.miles-onboarding-primary,.miles-onboarding-secondary,.miles-onboarding-entry button{border-radius:999px;padding:9px 13px;border:1px solid rgba(255,255,255,.16);font-weight:700;cursor:pointer}.miles-onboarding-primary{background:linear-gradient(135deg,#60a5fa,#818cf8);color:#0f172a}.miles-onboarding-secondary{background:rgba(255,255,255,.08);color:#e2e8f0}.miles-onboarding-secondary:disabled{opacity:.4;cursor:not-allowed}.miles-onboarding-entry{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.miles-onboarding-entry button{background:rgba(255,255,255,.08);color:#e2e8f0}.miles-onboarding-entry button:first-child{background:#dbeafe;color:#172554}.miles-onboarding-target{position:relative!important;z-index:1001!important;outline:3px solid rgba(96,165,250,.92)!important;outline-offset:5px!important;box-shadow:0 0 0 9px rgba(96,165,250,.14),0 0 26px rgba(96,165,250,.52)!important;border-radius:12px!important;transition:box-shadow .25s ease,outline-color .25s ease!important}.miles-onboarding-target::after{content:"";position:absolute;inset:-9px;border:1px solid rgba(191,219,254,.6);border-radius:inherit;pointer-events:none}.miles-onboarding-card button:focus-visible{outline:2px solid #bfdbfe;outline-offset:2px}@keyframes miles-onboarding-in{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}@media(max-width:640px){.miles-onboarding-card{bottom:max(16px,env(safe-area-inset-bottom));left:14px!important;top:auto!important;transform:none!important;width:calc(100vw - 28px)}.miles-onboarding-scrim{background:rgba(15,23,42,.1)}}@media(prefers-reduced-motion:reduce){.miles-onboarding-card{animation:none}.miles-onboarding-target{transition:none!important}}
      `}</style>
    </>
  );
}

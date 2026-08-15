'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import MilesTourBubble from './MilesTourBubble';
import MilesTourHighlight from './MilesTourHighlight';
import { getOnboardingForRole, getPublicOnboarding, MILES_ONBOARDING_VERSION, type MilesOnboardingStep } from '@/lib/miles/onboarding';

const GUEST_KEY = 'mastercart-miles-public-onboarding-v1';
const PROGRESS_EVENT = 'mastercart:miles-onboarding-start';
const STARTED_EVENT = 'mastercart:miles-onboarding-started';
const TOUR_ROUTES = new Set(['/','/explore','/reels','/vendors','/dashboard/customer','/dashboard/vendor','/dashboard/delivery','/admin','/university-admin']);
const DEFAULT_DURATION = 3600;

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

function roleSteps(data: RemoteState) {
  return data.authenticated
    ? getOnboardingForRole(data.role || 'customer', { capabilities: data.capabilities || [], roles: data.roles || [], permissions: data.permissions || [] })
    : getPublicOnboarding();
}

export default function MilesOnboarding() {
  const pathname = usePathname();
  const router = useRouter();
  const [remote, setRemote] = useState<RemoteState | null>(null);
  const [steps, setSteps] = useState<MilesOnboardingStep[]>([]);
  const [active, setActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [resumeOffer, setResumeOffer] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const targetRef = useRef<Element | null>(null);
  const missingTimerRef = useRef<number | null>(null);

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
    const nextSteps = mode === 'public' ? getPublicOnboarding() : getOnboardingForRole(remote?.role || 'customer', { capabilities: remote?.capabilities || [], roles: remote?.roles || [], permissions: remote?.permissions || [] });
    const safeStep = Math.min(Math.max(0, requestedStep), Math.max(0, nextSteps.length - 1));
    setSteps(nextSteps);
    setStepIndex(safeStep);
    setPaused(false);
    setResumeOffer(false);
    setActive(true);
    window.dispatchEvent(new CustomEvent(STARTED_EVENT));
    void persist(safeStep, { onboardingStarted: true, completed: false, skipped: false });
  }, [persist, remote?.authenticated, remote?.capabilities, remote?.permissions, remote?.role, remote?.roles]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch('/api/onboarding/miles', { cache: 'no-store' });
        const data = await response.json() as RemoteState;
        if (cancelled) return;
        setRemote(data);
        const nextSteps = roleSteps(data);
        setSteps(nextSteps);
        if (data.authenticated) {
          const progress = data.progress;
          const incomplete = Boolean(progress && progress.onboarding_version === MILES_ONBOARDING_VERSION && !progress.completed && !progress.skipped);
          const savedStep = Math.min(progress?.current_step || 0, Math.max(0, nextSteps.length - 1));
          setStepIndex(savedStep);
          if (!progress || progress.onboarding_version !== MILES_ONBOARDING_VERSION) {
            window.setTimeout(() => {
              if (cancelled) return;
              window.dispatchEvent(new CustomEvent(STARTED_EVENT));
              setActive(true);
            }, 700);
          } else if (incomplete && savedStep > 0) {
            window.dispatchEvent(new CustomEvent(STARTED_EVENT));
            setResumeOffer(true);
            setActive(true);
          } else if (incomplete) {
            window.setTimeout(() => {
              if (cancelled) return;
              window.dispatchEvent(new CustomEvent(STARTED_EVENT));
              setActive(true);
            }, 700);
          } else {
            setActive(false);
            setResumeOffer(false);
          }
        } else {
          let guestState: { currentStep?: number; completed?: boolean; skipped?: boolean } = {};
          try { guestState = JSON.parse(window.localStorage.getItem(GUEST_KEY) || '{}'); } catch {}
          const savedStep = Math.min(guestState.currentStep || 0, Math.max(0, nextSteps.length - 1));
          setStepIndex(savedStep);
          if (guestState.currentStep && savedStep > 0 && !guestState.completed && !guestState.skipped) {
            window.dispatchEvent(new CustomEvent(STARTED_EVENT));
            setResumeOffer(true);
            setActive(true);
          } else if (!guestState.completed && !guestState.skipped) {
            window.setTimeout(() => {
              if (cancelled) return;
              window.dispatchEvent(new CustomEvent(STARTED_EVENT));
              setActive(true);
            }, 900);
          } else {
            setActive(false);
            setResumeOffer(false);
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
      const detail = (event as CustomEvent<{ mode?: 'public' | 'authenticated'; step?: number }>).detail;
      start(detail?.mode, detail?.step || 0);
    };
    const handleEnd = () => { setActive(false); setResumeOffer(false); setPaused(false); };
    window.addEventListener(PROGRESS_EVENT, handleRestart);
    window.addEventListener('mastercart:miles-onboarding-end', handleEnd);
    return () => {
      window.removeEventListener(PROGRESS_EVENT, handleRestart);
      window.removeEventListener('mastercart:miles-onboarding-end', handleEnd);
    };
  }, [start]);

  const closeTour = useCallback((status: 'completed' | 'skipped') => {
    setActive(false);
    setPaused(false);
    setResumeOffer(false);
    setTargetRect(null);
    void persist(stepIndex, { [status]: true, completed: status === 'completed', skipped: status === 'skipped' });
  }, [persist, stepIndex]);

  useEffect(() => {
    if (!active || resumeOffer || !currentStep) return;
    if (!TOUR_ROUTES.has(currentStep.route)) {
      console.warn(`[MilesTour] Refusing unknown route: ${currentStep.route}`);
      window.setTimeout(() => setStepIndex((value) => Math.min(value + 1, Math.max(0, steps.length - 1))), 0);
      return;
    }
    if (pathname !== currentStep.route) {
      router.push(currentStep.route);
      return;
    }
    if (currentStep.activate) {
      window.dispatchEvent(new CustomEvent('mastercart:miles-tour-activate', { detail: { route: currentStep.route, tab: currentStep.activate } }));
    }
  }, [active, currentStep, pathname, resumeOffer, router, steps.length]);

  useEffect(() => {
    if (!active || resumeOffer || !currentStep || waiting) return;
    let frame = 0;
    let attempts = 0;
    let found = false;
    const locate = () => {
      const target = currentStep.target ? document.querySelector(currentStep.target) : null;
      if (target) {
        found = true;
        targetRef.current = target;
        const rect = target.getBoundingClientRect();
        setTargetRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
        return;
      }
      if (currentStep.target && attempts < 18) {
        attempts += 1;
        frame = window.requestAnimationFrame(locate);
        return;
      }
      targetRef.current = null;
      setTargetRect(null);
      if (currentStep.target) {
        console.info(`[MilesTour] Skipping missing target ${currentStep.target} on ${currentStep.route}`);
        missingTimerRef.current = window.setTimeout(() => {
          if (!found) {
            if (stepIndex >= steps.length - 1) closeTour('completed');
            else setStepIndex((value) => value + 1);
          }
        }, 360);
      }
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
      if (missingTimerRef.current) window.clearTimeout(missingTimerRef.current);
      targetRef.current = null;
      setTargetRect(null);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  // The target is intentionally re-located for every route and step.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, currentStep, pathname, resumeOffer, waiting, stepIndex, steps.length]);

  const advance = useCallback(() => {
    if (isLast) { closeTour('completed'); return; }
    const nextIndex = stepIndex + 1;
    setStepIndex(nextIndex);
    void persist(nextIndex, { onboardingStarted: true });
  }, [closeTour, isLast, persist, stepIndex]);

  useEffect(() => {
    if (!active || paused || resumeOffer || waiting || !currentStep || (currentStep.target && !targetRect)) return;
    const timer = window.setTimeout(advance, currentStep.duration || DEFAULT_DURATION);
    return () => window.clearTimeout(timer);
  }, [active, advance, currentStep, paused, resumeOffer, targetRect, waiting]);

  const back = () => { if (stepIndex > 0) setStepIndex((value) => value - 1); };
  const startOver = () => start(isPublic ? 'public' : 'authenticated', 0);
  const resume = () => { setResumeOffer(false); setPaused(false); setActive(true); void persist(stepIndex, { onboardingStarted: true, completed: false, skipped: false }); };

  if (!active || !remote || !currentStep) return null;

  const title = resumeOffer ? 'Welcome back — your tour is waiting' : waiting ? 'Let’s move to the next section' : currentStep.title;
  const message = resumeOffer ? `You paused your ${isPublic ? 'MasterCart introduction' : 'role-specific MasterCart tour'} at step ${stepIndex + 1}. Would you like to continue where you left off?` : waiting ? 'I’m taking you there now. Your session and current tour progress will stay intact.' : currentStep.message;

  return (
    <>
      <MilesTourHighlight rect={targetRect} active={active && !resumeOffer} />
      <MilesTourBubble
        rect={resumeOffer || waiting ? null : targetRect}
        title={title}
        message={message}
        stepLabel={!resumeOffer && !waiting ? `Step ${stepIndex + 1} of ${steps.length}` : undefined}
        side={currentStep.side}
        waiting={waiting}
        isPaused={paused}
        isLast={isLast}
        onSkip={() => closeTour('skipped')}
        onPause={() => setPaused((value) => !value)}
        onBack={back}
        onNext={resumeOffer ? startOver : advance}
        onResume={resume}
        canGoBack={stepIndex > 0 && !resumeOffer}
        resumePrompt={resumeOffer}
      />
    </>
  );
}

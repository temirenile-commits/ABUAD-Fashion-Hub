'use client';

import { useEffect } from 'react';

/**
 * Compatibility bridge for older imports. The application now renders exactly
 * one tour engine: the root-mounted MilesOnboarding component.
 */
export default function AppTour() {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('mastercart:miles-onboarding-start', { detail: { mode: 'authenticated' } }));
  }, []);
  return null;
}

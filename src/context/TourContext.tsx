'use client';

import React, { createContext, useContext } from 'react';
import { TOURS } from '@/lib/tours';

type TourContextType = {
  startTour: (tourId: string) => void;
  endTour: () => void;
};

const TourContext = createContext<TourContextType | undefined>(undefined);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const startTour = (tourId: string) => {
    if (!TOURS[tourId] || typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('mastercart:miles-onboarding-start', { detail: { mode: 'authenticated', tourId } }));
  };

  const endTour = () => {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('mastercart:miles-onboarding-end'));
  };

  return <TourContext.Provider value={{ startTour, endTour }}>{children}</TourContext.Provider>;
}

export const useTour = () => {
  const context = useContext(TourContext);
  if (!context) throw new Error('useTour must be used within TourProvider');
  return context;
};

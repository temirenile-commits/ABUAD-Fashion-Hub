'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { TOURS, TourStep } from '@/lib/tours';

type TourContextType = {
  startTour: (tourId: string) => void;
  endTour: () => void;
};

const TourContext = createContext<TourContextType | undefined>(undefined);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [activeTour, setActiveTour] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const pathname = usePathname();
  const router = useRouter();
  const driverRef = useRef<any>(null);

  const endTour = () => {
    setActiveTour(null);
    setCurrentStepIndex(0);
    if (driverRef.current) {
      try { driverRef.current.destroy(); } catch(e){}
      driverRef.current = null;
    }
  };

  const startTour = (tourId: string) => {
    if (!TOURS[tourId]) return;
    endTour();
    setTimeout(() => {
      setActiveTour(tourId);
      setCurrentStepIndex(0);
    }, 100);
  };

  useEffect(() => {
    if (!activeTour) return;

    const tour = TOURS[activeTour];
    const targetStep = tour[currentStepIndex];

    if (!targetStep) {
      endTour();
      return;
    }

    // If step is on a different route, navigate there first
    if (pathname !== targetStep.route) {
      router.push(targetStep.route);
      return; // wait for pathname to update
    }

    // We are on the correct route. Give the DOM a moment to render elements.
    const timer = setTimeout(() => {
      // Find all contiguous steps on this page
      const pageSteps: { step: TourStep; originalIndex: number }[] = [];
      let i = currentStepIndex;
      while (i < tour.length && tour[i].route === pathname) {
        pageSteps.push({ step: tour[i], originalIndex: i });
        i++;
      }

      if (driverRef.current) {
        try { driverRef.current.destroy(); } catch(e){}
      }

      driverRef.current = driver({
        showProgress: true,
        animate: true,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        steps: pageSteps.map((p) => ({
          element: p.step.element,
          popover: {
            title: p.step.title,
            description: p.step.description,
            side: p.step.side || 'bottom',
            align: p.step.align || 'start',
            showButtons: ['next', 'previous', 'close'],
            popoverClass: 'vivid-tour-popover'
          }
        })),
        onDestroyStarted: () => {
          if (driverRef.current && !driverRef.current.hasNextStep()) {
             // Valid destruction via completion of page chunk
             try { driverRef.current.destroy(); } catch(e){}
          } else {
             // User manually closed it
             endTour();
          }
        },
        onNextClick: () => {
          if (!driverRef.current) return;
          if (!driverRef.current.hasNextStep()) {
            // End of this page's chunk. Move to next page chunk.
            try { driverRef.current.destroy(); } catch(e){}
            if (i < tour.length) {
              setCurrentStepIndex(i);
            } else {
              endTour();
            }
          } else {
            driverRef.current.moveNext();
          }
        }
      });

      driverRef.current.drive();

    }, 600); // Wait for dynamic content to load

    return () => clearTimeout(timer);
  }, [activeTour, currentStepIndex, pathname, router]);

  return (
    <TourContext.Provider value={{ startTour, endTour }}>
      {children}
    </TourContext.Provider>
  );
}

export const useTour = () => {
  const context = useContext(TourContext);
  if (!context) throw new Error('useTour must be used within TourProvider');
  return context;
};

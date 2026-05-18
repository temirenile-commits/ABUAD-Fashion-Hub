'use client';
import { useEffect, useState } from 'react';
import { useTour } from '@/context/TourContext';
import { supabase } from '@/lib/supabase';
import { usePathname } from 'next/navigation';

export default function AutoTourTrigger() {
  const { startTour } = useTour();
  const pathname = usePathname();
  const [hasTriggered, setHasTriggered] = useState(false);

  useEffect(() => {
    // Only run this logic once per session load, and wait a bit for initial data
    if (hasTriggered) return;

    const checkAndTriggerTour = async () => {
      // Allow it to run on admin pages now because we have admin tours!
      // But skip auth pages.
      if (pathname?.startsWith('/auth')) return;

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        // Logged out user (Guest)
        const guestTourDone = localStorage.getItem('mastercart_guest_tour');
        if (!guestTourDone) {
          localStorage.setItem('mastercart_guest_tour', 'true');
          startTour('customer_onboarding');
          setHasTriggered(true);
        }
        return;
      }

      // Logged in user: check their role to determine which tour to run
      const { data: profile } = await supabase.from('users').select('role').eq('id', session.user.id).single();
      const role = profile?.role || 'customer';

      const tourKey = `mastercart_tour_${role}_v2`;
      const hasSeenTour = localStorage.getItem(tourKey);

      if (!hasSeenTour) {
        localStorage.setItem(tourKey, 'true');
        
        if (role === 'admin') {
          startTour('admin_onboarding');
        } else if (role === 'university_admin') {
          startTour('uni_admin_onboarding');
        } else if (role === 'vendor' || role === 'delicacies_vendor') {
          startTour('vendor_onboarding');
        } else {
          startTour('customer_onboarding');
        }
        setHasTriggered(true);
      }
    };

    const timer = setTimeout(checkAndTriggerTour, 2000); // Wait 2s for layout stability
    return () => clearTimeout(timer);
  }, [pathname, hasTriggered, startTour]);

  return null; // Invisible logical component
}

'use client';
import { useEffect } from 'react';

export default function ProfileViewTracker({ brandId }: { brandId: string }) {
  useEffect(() => {
    if (!brandId) return;
    
    const trackView = async () => {
      try {
        await fetch('/api/vendor/view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brandId }),
        });
      } catch (e) {
        console.error('Failed to track brand profile view');
      }
    };

    trackView();
  }, [brandId]);

  return null;
}

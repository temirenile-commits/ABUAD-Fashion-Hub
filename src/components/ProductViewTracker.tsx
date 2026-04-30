'use client';
import { useEffect } from 'react';

export default function ProductViewTracker({ productId }: { productId: string }) {
  useEffect(() => {
    if (!productId) return;
    
    // We use a small delay or just fire and forget to avoid slowing down page load
    const trackView = async () => {
      try {
        await fetch('/api/product/view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId }),
        });
      } catch (e) {
        console.error('Failed to track product view');
      }
    };

    trackView();
  }, [productId]);

  return null;
}

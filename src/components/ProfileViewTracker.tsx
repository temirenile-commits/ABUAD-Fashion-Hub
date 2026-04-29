'use client';
import { useEffect } from 'react';

export default function ProfileViewTracker({ brandId }: { brandId: string }) {
  useEffect(() => {
    if (!brandId) return;
    fetch('/api/vendor/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandId }),
    }).catch(() => {});
  }, [brandId]);

  return null;
}

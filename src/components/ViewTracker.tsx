'use client';
import { useEffect } from 'react';

export default function ViewTracker({ category }: { category: string }) {
  useEffect(() => {
    if (!category) return;
    try {
      const prefsStr = localStorage.getItem('user_prefs') || '[]';
      let prefs: string[] = JSON.parse(prefsStr);
      if (!Array.isArray(prefs)) prefs = [];
      
      // Add category if not present
      if (!prefs.includes(category)) {
        prefs.unshift(category); // Add to beginning (most recent)
        // Keep only top 5 preferences
        if (prefs.length > 5) prefs = prefs.slice(0, 5);
        localStorage.setItem('user_prefs', JSON.stringify(prefs));
      } else {
        // Move to beginning
        prefs = prefs.filter(c => c !== category);
        prefs.unshift(category);
        localStorage.setItem('user_prefs', JSON.stringify(prefs));
      }
    } catch {}
  }, [category]);

  return null;
}

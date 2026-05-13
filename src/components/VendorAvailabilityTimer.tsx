'use client';
import { useEffect, useState, useCallback } from 'react';
import { Clock } from 'lucide-react';

interface VendorAvailabilityTimerProps {
  availabilityStart?: string; // "HH:MM:SS"
  availabilityEnd?: string;
  isAvailableNow: boolean;
}

function parseTime(t: string): { h: number; m: number } {
  const [h, m] = t.split(':').map(Number);
  return { h, m };
}

export default function VendorAvailabilityTimer({
  availabilityStart,
  availabilityEnd,
  isAvailableNow,
}: VendorAvailabilityTimerProps) {
  const [timeUntil, setTimeUntil] = useState<string | null>(null);

  const compute = useCallback(() => {
    if (!availabilityStart || isAvailableNow) { setTimeUntil(null); return; }
    const now = new Date();
    const start = parseTime(availabilityStart);
    const opens = new Date(now);
    opens.setHours(start.h, start.m, 0, 0);
    if (opens < now) opens.setDate(opens.getDate() + 1); // tomorrow

    const diff = Math.floor((opens.getTime() - now.getTime()) / 1000);
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    setTimeUntil(h > 0 ? `Opens in ${h}h ${m}m` : `Opens in ${m}m`);
  }, [availabilityStart, isAvailableNow]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    compute();
    const id = setInterval(compute, 60000);
    return () => clearInterval(id);
  }, [compute]);

  if (!availabilityStart && !availabilityEnd) return null;

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
      background: isAvailableNow ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
      border: `1px solid ${isAvailableNow ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
      borderRadius: 999, padding: '3px 10px',
      fontSize: '0.72rem', fontWeight: 700,
      color: isAvailableNow ? '#10b981' : '#ef4444'
    }}>
      <Clock size={11} />
      {isAvailableNow
        ? (availabilityEnd ? `Open until ${availabilityEnd.slice(0, 5)}` : 'Open Now')
        : (timeUntil || 'Closed')
      }
    </div>
  );
}

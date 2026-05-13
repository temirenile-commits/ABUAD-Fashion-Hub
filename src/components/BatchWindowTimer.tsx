'use client';
import { useEffect, useState, useCallback } from 'react';

interface BatchWindowTimerProps {
  onBatchClose?: () => void;
}

function getNextBatchEnd(): Date {
  const now = new Date();
  const mins = now.getMinutes();
  // Next boundary: every 30 mins
  const nextBoundary = mins < 30 ? 30 : 60;
  const next = new Date(now);
  next.setMinutes(nextBoundary, 0, 0);
  if (nextBoundary === 60) next.setHours(next.getHours() + 1);
  return next;
}

export default function BatchWindowTimer({ onBatchClose }: BatchWindowTimerProps) {
  const [timeLeft, setTimeLeft] = useState(0);

  const compute = useCallback(() => {
    const end = getNextBatchEnd();
    const diff = Math.max(0, Math.floor((end.getTime() - Date.now()) / 1000));
    if (diff === 0 && onBatchClose) onBatchClose();
    setTimeLeft(diff);
  }, [onBatchClose]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    compute();
    const id = setInterval(compute, 1000);
    return () => clearInterval(id);
  }, [compute]);

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const pct = (timeLeft / (30 * 60)) * 100;
  const urgent = timeLeft < 5 * 60; // < 5 mins

  return (
    <div style={{
      background: urgent
        ? 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))'
        : 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))',
      border: `1px solid ${urgent ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.25)'}`,
      borderRadius: 12,
      padding: '0.9rem 1rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: urgent ? '#ef4444' : '#f59e0b' }}>
          {urgent ? '⚡ Batch closing soon!' : '🕐 Current Batch Window'}
        </span>
        <span style={{ fontWeight: 800, fontSize: '1.1rem', fontVariantNumeric: 'tabular-nums', color: urgent ? '#ef4444' : '#f59e0b' }}>
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </span>
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 99 }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: urgent ? '#ef4444' : '#f59e0b',
          borderRadius: 99,
          transition: 'width 1s linear'
        }} />
      </div>
      <p style={{ fontSize: '0.65rem', color: 'var(--text-400)', marginTop: '0.4rem', margin: '0.4rem 0 0' }}>
        Orders placed together in this window are batched for delivery 🚀
      </p>
    </div>
  );
}

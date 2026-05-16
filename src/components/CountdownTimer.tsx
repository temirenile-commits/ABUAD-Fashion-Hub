'use client';
import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  expiryDate: string;
  onExpiry?: () => void;
  compact?: boolean;
}

export default function CountdownTimer({ expiryDate, onExpiry, compact = false }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    expired: boolean;
  } | null>(null);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = +new Date(expiryDate) - +new Date();
      
      if (difference <= 0) {
        if (onExpiry) onExpiry();
        return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
        expired: false
      };
    };

    // Initial calculation
    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const updated = calculateTimeLeft();
      setTimeLeft(updated);
      if (updated.expired) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiryDate, onExpiry]);

  if (!timeLeft) return null;

  if (timeLeft.expired) {
    return (
      <div style={{ fontSize: compact ? '0.7rem' : '0.85rem', color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <CheckCircle size={compact ? 12 : 14} />
        <span>Arriving Now</span>
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '0.4rem',
      background: 'rgba(59, 130, 246, 0.1)',
      color: '#3b82f6',
      padding: compact ? '2px 6px' : '4px 10px',
      borderRadius: '6px',
      border: '1px solid rgba(59, 130, 246, 0.2)',
      fontSize: compact ? '0.7rem' : '0.8rem',
      fontWeight: 700,
      width: 'fit-content'
    }}>
      <Clock size={compact ? 12 : 14} />
      <div style={{ display: 'flex', gap: '0.3rem' }}>
        {timeLeft.days > 0 && <span>{timeLeft.days}d</span>}
        <span>{timeLeft.hours.toString().padStart(2, '0')}h</span>
        <span>{timeLeft.minutes.toString().padStart(2, '0')}m</span>
        {!compact && <span>{timeLeft.seconds.toString().padStart(2, '0')}s</span>}
      </div>
    </div>
  );
}

const CheckCircle = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

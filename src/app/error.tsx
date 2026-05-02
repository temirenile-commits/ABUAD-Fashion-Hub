'use client';
import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global Error Boundary caught an error:', error);
  }, [error]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', padding: '2rem' }}>
      <h2 style={{ fontSize: '2rem', marginBottom: '1rem', color: 'var(--primary)' }}>Oops! Something went wrong.</h2>
      <p style={{ color: 'var(--text-300)', marginBottom: '2rem', maxWidth: '500px' }}>
        We encountered an unexpected error. Our team has been notified. 
        Please try refreshing the page or navigating back home.
      </p>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <button className="btn btn-secondary" onClick={() => reset()}>
          Try Again
        </button>
        <Link href="/" className="btn btn-primary">
          Return Home
        </Link>
      </div>
    </div>
  );
}

import Link from 'next/link';
import { Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', padding: '2rem' }}>
      <Search size={64} style={{ color: 'var(--text-400)', marginBottom: '1.5rem' }} />
      <h2 style={{ fontSize: '2rem', marginBottom: '1rem', color: 'var(--primary)' }}>404 - Page Not Found</h2>
      <p style={{ color: 'var(--text-300)', marginBottom: '2rem', maxWidth: '500px' }}>
        The page you are looking for doesn't exist or has been moved.
      </p>
      <Link href="/" className="btn btn-primary">
        Return Home
      </Link>
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function UniversityAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/auth/login?redirect=/university-admin');
        return;
      }

      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single();

      const allowed = ['university_admin', 'university_staff', 'admin', 'super_admin'];
      if (!profile || !allowed.includes(profile.role)) {
        setDenied(true);
      }
      setChecking(false);
    };
    checkAccess();
  }, [router]);

  if (checking) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0f', color: '#fff', fontSize: '1.1rem' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #7c3aed', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 1rem' }} />
          Verifying access...
        </div>
      </div>
    );
  }

  if (denied) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0f', color: '#fff', textAlign: 'center', padding: '2rem' }}>
        <div>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔒</div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Access Denied</h1>
          <p style={{ color: '#888', marginBottom: '2rem' }}>You don&apos;t have university admin permissions.</p>
          <button
            onClick={() => router.push('/')}
            style={{ padding: '0.75rem 2rem', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
          >
            Return to Marketplace
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

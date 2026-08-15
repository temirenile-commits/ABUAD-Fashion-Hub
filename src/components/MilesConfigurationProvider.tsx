'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type MilesClientConfiguration = {
  identity: { name: string; initial: string; avatar: string | null; displayName: string };
  permissions: { readEnabled: boolean; writeEnabled: boolean };
  assistance: { proactiveEnabled: boolean; notificationsEnabled: boolean; tourGuideEnabled: boolean };
  personality?: Record<string, unknown>;
  capabilities?: Record<string, { read: boolean; write: boolean }>;
  allowedTools?: string[];
  vendor?: { aiEnabled: boolean; autoReplyEnabled: boolean; customInstructions: string; storeAccessEnabled: boolean; storeWriteEnabled: boolean };
  context?: { roles: string[]; permissions: string[]; isOverallSuperAdmin: boolean; universityIds: string[] | null };
};

const DEFAULT: MilesClientConfiguration = {
  identity: { name: 'Miles', initial: 'M', avatar: null, displayName: 'Miles' },
  permissions: { readEnabled: true, writeEnabled: false },
  assistance: { proactiveEnabled: true, notificationsEnabled: true, tourGuideEnabled: true },
  capabilities: {},
  allowedTools: [],
  vendor: { aiEnabled: true, autoReplyEnabled: false, customInstructions: '', storeAccessEnabled: false, storeWriteEnabled: false },
};

const MilesConfigurationContext = createContext<{ configuration: MilesClientConfiguration; loading: boolean; refresh: () => Promise<void> }>({ configuration: DEFAULT, loading: true, refresh: async () => undefined });

export function MilesConfigurationProvider({ children }: { children: React.ReactNode }) {
  const [configuration, setConfiguration] = useState(DEFAULT);
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setConfiguration(DEFAULT); return; }
      const response = await fetch('/api/miles/configuration', { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json() as { effective?: MilesClientConfiguration; context?: MilesClientConfiguration['context'] };
      if (data.effective) setConfiguration({ ...DEFAULT, ...data.effective, context: data.context });
    } catch { /* public/default configuration remains safe */ }
    finally { setLoading(false); }
  };
  useEffect(() => {
    void refresh();
    const { data: listener } = supabase.auth.onAuthStateChange(() => { void refresh(); });
    return () => listener.subscription.unsubscribe();
  }, []);
  const value = useMemo(() => ({ configuration, loading, refresh }), [configuration, loading]);
  return <MilesConfigurationContext.Provider value={value}>{children}</MilesConfigurationContext.Provider>;
}

export function useMilesConfiguration() { return useContext(MilesConfigurationContext); }

export function MilesIdentity({ name, initial, size = 36, className = '', label }: { name?: string; initial?: string; size?: number; className?: string; label?: string }) {
  const configuration = useMilesConfiguration().configuration;
  const activeName = name || configuration.identity.name;
  const activeInitial = initial || configuration.identity.initial;
  return <span className={`miles-identity ${className}`} role="img" aria-label={label || `${activeName} profile picture`} style={{ width: size, height: size, minWidth: size, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#2563eb,#4f46e5)', border: '1px solid rgba(255,255,255,.28)', boxShadow: '0 5px 16px rgba(0,0,0,.24),0 0 12px rgba(37,99,235,.18)', color: '#fff', overflow: 'hidden' }}>
    {configuration.identity.avatar ? <img src={configuration.identity.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span className="miles-initial" aria-hidden="true">{activeInitial}</span>}
    <style>{`.miles-initial{display:inline-block;font-family:"Brush Script MT","Segoe Script","URW Chancery L",cursive;font-style:italic;font-weight:700;font-size:1.35em;line-height:1;transform:translateY(-1px) rotate(-8deg);text-shadow:1px 2px 0 rgba(15,23,42,.22),0 0 9px rgba(255,255,255,.24)}`}</style>
  </span>;
}

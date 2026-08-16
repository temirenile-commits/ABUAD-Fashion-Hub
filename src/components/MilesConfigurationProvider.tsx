'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import MilesVisualIdentity from '@/components/MilesVisualIdentity';

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
    const initialLoad = window.setTimeout(() => { void refresh(); }, 0);
    const { data: listener } = supabase.auth.onAuthStateChange(() => { void refresh(); });
    return () => { window.clearTimeout(initialLoad); listener.subscription.unsubscribe(); };
  }, []);
  const value = useMemo(() => ({ configuration, loading, refresh }), [configuration, loading]);
  return <MilesConfigurationContext.Provider value={value}>{children}</MilesConfigurationContext.Provider>;
}

export function useMilesConfiguration() { return useContext(MilesConfigurationContext); }

export function MilesIdentity({ name, initial, size = 36, className = '', label }: { name?: string; initial?: string; size?: number; className?: string; label?: string }) {
  const configuration = useMilesConfiguration().configuration;
  const activeName = name || configuration.identity.name;
  const activeInitial = initial || configuration.identity.initial;
  return <MilesVisualIdentity name={activeName} initial={activeInitial} avatar={configuration.identity.avatar} size={size} className={className} compact label={label} />;
}

'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface NotificationContextType {
  unreadCount: number;
  permission: NotificationPermission;
  requestPermission: () => Promise<void>;
  markAllRead: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

function firePushNotification(title: string, body: string, url?: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const n = new Notification(title, {
    body,
    icon: '/logo.png',
    badge: '/logo.png',
    tag: title,
    requireInteraction: false,
  });

  if (url) {
    n.onclick = () => {
      window.focus();
      window.location.href = url;
    };
  }
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const userIdRef = useRef<string | null>(null);

  // ── Auto-request permission once the user is logged in ──────────────────────
  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') { setPermission('granted'); return; }
    if (Notification.permission === 'denied') { setPermission('denied'); return; }
    const result = await Notification.requestPermission();
    setPermission(result);
  }, []);

  const handleIncoming = useCallback((title: string, body: string, url?: string) => {
    setUnreadCount(c => c + 1);
    // Sound
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
    // Native push
    firePushNotification(title, body, url);
  }, []);

  const markAllRead = useCallback(() => setUnreadCount(0), []);

  useEffect(() => {
    // Init audio
    audioRef.current = new Audio('/notification.mp3');

    // Read current permission state
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }

    let cleanup: (() => void) | undefined;

    const boot = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const userId = session.user.id;
      userIdRef.current = userId;

      // ── Auto-prompt permission for logged-in users ─────────────────────────
      if (Notification.permission === 'default') {
        await requestPermission();
      }

      // ── Fetch existing unread count from DB ────────────────────────────────
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);
      if (count) setUnreadCount(count);

      // ── Subscribe: personal notifications table ────────────────────────────
      const notifyChannel = supabase
        .channel(`notify-${userId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        }, (payload) => {
          handleIncoming(
            payload.new.title || 'ABUAD Fashion Hub',
            payload.new.content || payload.new.body || '',
            payload.new.url
          );
        })
        .subscribe();

      // ── Subscribe: broadcast notifications (no user_id filter = admin blasts) ──
      const broadcastChannel = supabase
        .channel('notify-broadcast')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: 'user_id=is.null',
        }, (payload) => {
          handleIncoming(
            payload.new.title || 'Platform Notice',
            payload.new.content || '',
          );
        })
        .subscribe();

      // ── Subscribe: incoming messages ────────────────────────────────────────
      const msgChannel = supabase
        .channel(`msg-${userId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${userId}`,
        }, (payload) => {
          handleIncoming('📩 New Enquiry', payload.new.content?.substring(0, 80) ?? '', '/notifications');
        })
        .subscribe();

      // ── Subscribe: my orders status change ─────────────────────────────────
      const orderChannel = supabase
        .channel(`orders-${userId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `customer_id=eq.${userId}`,
        }, (payload) => {
          const status: string = payload.new.status ?? '';
          const labels: Record<string, string> = {
            in_transit: '🚚 Your order is on the way!',
            delivered: '📦 Your order has been delivered! Confirm receipt to release payment.',
            confirmed: '✅ Delivery confirmed. Thank you!',
          };
          if (labels[status]) {
            handleIncoming(labels[status], `Order #${String(payload.new.id).slice(0, 8).toUpperCase()}`, '/dashboard/customer');
          }
        })
        .subscribe();

      cleanup = () => {
        supabase.removeChannel(notifyChannel);
        supabase.removeChannel(broadcastChannel);
        supabase.removeChannel(msgChannel);
        supabase.removeChannel(orderChannel);
      };
    };

    boot();
    return () => { cleanup?.(); };
  }, [handleIncoming, requestPermission]);

  return (
    <NotificationContext.Provider value={{ unreadCount, permission, requestPermission, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
};

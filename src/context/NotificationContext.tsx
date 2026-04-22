'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface NotificationContextType {
  unreadCount: number;
  requestPermission: () => Promise<void>;
  permission: NotificationPermission;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // 1. Initialize Audio
    audioRef.current = new Audio('/notification.mp3');

    // 2. Initial Permission Check
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }

    // 3. Real-time Subscriptions
    const setupRealtime = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Subscribe to messages (enquiries)
      const messageChannel = supabase
        .channel('messages-realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `receiver_id=eq.${session.user.id}`
          },
          (payload) => {
            console.log('New message received!', payload);
            handleIncomingNotification('New Enquiry', payload.new.content);
          }
        )
        .subscribe();

      // Subscribe to system notifications
      const notifyChannel = supabase
        .channel('notify-realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${session.user.id}`
          },
          (payload) => {
            console.log('New notification received!', payload);
            handleIncomingNotification(payload.new.title, payload.new.content);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(messageChannel);
        supabase.removeChannel(notifyChannel);
      };
    };

    setupRealtime();
  }, []);

  const handleIncomingNotification = (title: string, body: string) => {
    // 1. Increment Count
    setUnreadCount(prev => prev + 1);

    // 2. Play Sound
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.log('Audio playback failed:', e));
    }

    // 3. Browser Notification
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.ico'
      });
    }
  };

  const requestPermission = async () => {
    if (!('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  };

  return (
    <NotificationContext.Provider value={{ unreadCount, requestPermission, permission }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

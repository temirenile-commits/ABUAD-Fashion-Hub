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
    silent: false, // Use device's default notification sound
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
  const userIdRef = useRef<string | null>(null);

  // â”€â”€ Auto-request permission once the user is logged in â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') { setPermission('granted'); return; }
    if (Notification.permission === 'denied') { setPermission('denied'); return; }
    const result = await Notification.requestPermission();
    setPermission(result);
  }, []);

  const handleIncoming = useCallback((title: string, body: string, url?: string) => {
    setUnreadCount(c => c + 1);
    // Native push (this will trigger the device's native notification sound)
    firePushNotification(title, body, url);
  }, []);

  const markAllRead = useCallback(() => setUnreadCount(0), []);

  useEffect(() => {
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

      // â”€â”€ Auto-prompt permission for logged-in users â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      if (Notification.permission === 'default') {
        await requestPermission();
      }

      // â”€â”€ Fetch existing unread count from DB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const { count } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);
      if (count) setUnreadCount(count);

      // â”€â”€ Subscribe: personal notifications table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const notifyChannel = supabase
        .channel(`notify-${userId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        }, (payload) => {
          handleIncoming(
            payload.new.title || 'Master Cart',
            payload.new.content || payload.new.body || '',
            payload.new.link
          );
        })
        .subscribe();

      // â”€â”€ Subscribe: broadcast notifications (no user_id filter = admin blasts) â”€â”€
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

      // â”€â”€ Subscribe: incoming messages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

      // â”€â”€ Subscribe: my orders status change (Customer side) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
            paid: '💰 Payment Secured! The vendor has been notified.',
            in_transit: '🚚 Your order is on the way!',
            delivered: '📦 Your order has been delivered! Confirm receipt to release payment.',
            confirmed: '✅ Delivery confirmed. Thank you!',
          };
          if (labels[status]) {
            handleIncoming(labels[status], `Order #${String(payload.new.id).slice(0, 8).toUpperCase()}`, '/dashboard/customer');
          }
        })
        .subscribe();

      // â”€â”€ Subscribe: New orders received (Vendor side) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const vendorOrderChannel = supabase
        .channel(`vendor-orders-${userId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
        }, async (payload) => {
          // Check if this order belongs to the user's brand
          const { data: brand } = await supabase.from('brands').select('id').eq('owner_id', userId).single();
          if (brand && payload.new.brand_id === brand.id) {
            handleIncoming('🛒 New Order Received!', `You have a new order for ₦${Number(payload.new.total_amount).toLocaleString()}`, '/dashboard/vendor');
          }
        })
        .subscribe();

      // â”€â”€ Subscribe: Brand Trends & Account Events â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const brandChannel = supabase
        .channel(`brand-events-${userId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'brands',
          filter: `owner_id=eq.${userId}`,
        }, (payload) => {
          const oldTier = payload.old.subscription_tier;
          const newTier = payload.new.subscription_tier;
          if (oldTier !== newTier) {
            handleIncoming('⚡ Account Tier Upgraded', `Your store is now on the ${newTier.toUpperCase()} power level!`, '/dashboard/vendor');
          }
          
          if (payload.new.free_listings_count < 2 && payload.old.free_listings_count >= 2) {
            handleIncoming('âš ï¸ Low Credits', 'Your product upload credits are almost exhausted.', '/dashboard/vendor/plans');
          }
        })
        .subscribe();

      cleanup = () => {
        supabase.removeChannel(notifyChannel);
        supabase.removeChannel(broadcastChannel);
        supabase.removeChannel(msgChannel);
        supabase.removeChannel(orderChannel);
        supabase.removeChannel(vendorOrderChannel);
        supabase.removeChannel(brandChannel);
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


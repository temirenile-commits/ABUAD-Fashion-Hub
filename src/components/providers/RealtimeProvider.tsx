'use client';

import React, { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useMarketplaceStore } from '@/store/marketplaceStore';
import { Toaster, toast } from 'react-hot-toast';

export default function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const {
    addProduct, updateProduct, removeProduct, setProducts,
    addService, updateService, removeService, setServices,
    addVendor, updateVendor, setVendors,
    addOrder, updateOrder, setOrders,
    setInitialized, isInitialized
  } = useMarketplaceStore();

  useEffect(() => {
    let active = true;

    // --- INITIAL DATA FETCH ---
    const fetchInitialData = async () => {
      // Products
      const { data: prodData } = await supabase
        .from('products')
        .select(`*, brands(*)`)
        .order('created_at', { ascending: false });

      if (active && prodData) setProducts(prodData as any);

      // Brands (Vendors)
      const { data: brandData } = await supabase
        .from('brands')
        .select('*');

      if (active && brandData) setVendors(brandData as any);

      if (active) setInitialized(true);
    };

    if (!isInitialized) fetchInitialData();

    // We bind a single global channel for public tables
    const publicChannel = supabase.channel('public:marketplace');

    // --- PRODUCTS SYNC ---
    publicChannel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'products' },
      async (payload: any) => {
        if (payload.eventType === 'INSERT') {
          const { vendors } = useMarketplaceStore.getState();
          const brand = vendors.find((v: any) => v.id === payload.new.brand_id);
          const enriched = { ...payload.new, brands: brand };

          addProduct(enriched as any);
          if (!payload.new.is_draft) {
            toast.success(`New Product: ${payload.new.title}!`);
          }
        }
        if (payload.eventType === 'UPDATE') {
          const { vendors } = useMarketplaceStore.getState();
          const brand = vendors.find((v: any) => v.id === payload.new.brand_id);
          const enriched = { ...payload.new, brands: brand };

          updateProduct(payload.new.id, enriched as any);
        }
        if (payload.eventType === 'DELETE') {
          removeProduct(payload.old.id);
        }
      }
    );

    // --- SERVICES SYNC ---
    publicChannel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'services' },
      (payload: any) => {
        if (payload.eventType === 'INSERT') {
          addService(payload.new as any);
          toast.success(`New Service available: ${payload.new.title}`);
        }
        if (payload.eventType === 'UPDATE') {
          updateService(payload.new.id, payload.new as any);
        }
        if (payload.eventType === 'DELETE') {
          removeService(payload.old.id);
        }
      }
    );

    // --- VENDORS SYNC ---
    publicChannel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'brands' },
      (payload: any) => {
        if (payload.eventType === 'INSERT') {
          addVendor(payload.new as any);
        }
        if (payload.eventType === 'UPDATE') {
          updateVendor(payload.new.id, payload.new as any);
        }
      }
    );

    publicChannel.subscribe();

    // --- PRIVATE (AUTHED) SYNC ---
    let privateChannel: any;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && active) {
        // Orders (We listen to ALL orders but realistically RLS blocks ones not belonging to user)
        privateChannel = supabase.channel(`private:orders:${session.user.id}`);
        privateChannel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders' },
          (payload: any) => {
            // For Orders, if user is buyer or seller, RLS lets this through.
            if (payload.eventType === 'INSERT') {
              addOrder(payload.new);
              toast('You have a new Order update!', { icon: '📦' });
            }
            if (payload.eventType === 'UPDATE') {
              updateOrder(payload.new.id, payload.new);
              toast(`Order status changed to ${payload.new.status}`, { icon: '🔄' });
            }
          }
        ).subscribe();
      }
    });

    return () => {
      active = false;
      supabase.removeChannel(publicChannel);
      if (privateChannel) supabase.removeChannel(privateChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Toaster position="top-right" />
      {children}
    </>
  );
}

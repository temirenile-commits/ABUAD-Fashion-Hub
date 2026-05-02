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
    addReel, removeReel, setReels,
    setInitialized, isInitialized
  } = useMarketplaceStore();

  const ABUAD_ID = '00000000-0000-0000-0000-000000000001';

  useEffect(() => {
    let active = true;

    // --- INITIAL DATA FETCH ---
    const fetchInitialData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        let userUniId = null;
        if (session?.user) {
          const { data: profile } = await supabase.from('users').select('university_id').eq('id', session.user.id).single();
          userUniId = profile?.university_id;
        }

        // Products joined with brands and universities
        let query = supabase
          .from('products')
          .select(`*, brands(*, universities(*))`)
          .order('created_at', { ascending: false });

        if (userUniId) {
          // Strictly show only my university's products + global ones
          query = query.or(`visibility_type.eq.global,university_id.eq.${userUniId}`);
        } else {
          // Public users: Show ABUAD products by default + global
          query = query.or(`visibility_type.eq.global,university_id.eq.${ABUAD_ID}`);
        }

        const { data: prodData, error: prodError } = await query;

        if (prodError) throw prodError;

        if (active && prodData) {
          const enriched = prodData.map((p: any) => ({
            ...p,
            rating: p.rating || 5,
            reviews: p.reviews_count || 0,
            wishlist_count: 0
          }));
          setProducts(enriched);
        }

        // Brands (Vendors)
        let brandQuery = supabase.from('brands').select('*');
        if (userUniId) {
          brandQuery = brandQuery.eq('university_id', userUniId);
        } else {
          // Public users: Show ABUAD vendors by default
          brandQuery = brandQuery.eq('university_id', ABUAD_ID);
        }
        const { data: brandData, error: bErr } = await brandQuery;
        if (bErr) throw bErr;
        if (active && brandData) setVendors(brandData as any);

        // Brand Reels
        let reelQuery = supabase
          .from('brand_reels')
          .select('*, brands(name, logo_url)')
          .order('created_at', { ascending: false });

        if (userUniId) {
          reelQuery = reelQuery.eq('university_id', userUniId);
        } else {
          // Public users: Show ABUAD reels by default
          reelQuery = reelQuery.eq('university_id', ABUAD_ID);
        }
        
        const { data: reelData, error: rErr } = await reelQuery;
        if (rErr) throw rErr;
        if (active && reelData) setReels(reelData as any);

        if (active) setInitialized(true);
      } catch (err) {
        console.error('RealtimeProvider: Initial fetch failed:', err);
        // Still set initialized to true to prevent infinite loading, 
        // even if data is partial
        if (active) setInitialized(true);
      }
    };

    // Always re-fetch reels (they update frequently and must always be fresh)
    const fetchReels = async () => {
      const { data: reelData } = await supabase
        .from('brand_reels')
        .select('*, brands(name, logo_url)')
        .order('created_at', { ascending: false });
      if (active && reelData) setReels(reelData as any);
    };

    if (!isInitialized) fetchInitialData();
    fetchReels(); // Always refresh reels

    // We bind a single global channel for public tables
    const publicChannel = supabase.channel('public:marketplace');

    // --- PRODUCTS SYNC ---
    publicChannel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'products' },
      async (payload: any) => {
        if (payload.eventType === 'INSERT') {
          // Verify university scope before adding to store
          const { data: userProfile } = await supabase.from('users').select('university_id').eq('id', (await supabase.auth.getSession()).data.session?.user.id).single();
          const userUniId = userProfile?.university_id;
          
          if (payload.new.visibility_type === 'global' || payload.new.university_id === userUniId) {
            const { vendors } = useMarketplaceStore.getState();
            const brand = vendors.find((v: any) => v.id === payload.new.brand_id);
            const enriched = { ...payload.new, brands: brand };

            addProduct(enriched as any);
            if (!payload.new.is_draft) {
              toast.success(`New Product: ${payload.new.title}!`);
            }
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

    // --- REELS SYNC ---
    publicChannel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'brand_reels' },
      async (payload: any) => {
        if (payload.eventType === 'INSERT') {
          const { data: userProfile } = await supabase.from('users').select('university_id').eq('id', (await supabase.auth.getSession()).data.session?.user.id).single();
          const userUniId = userProfile?.university_id;

          if (payload.new.university_id === userUniId) {
            const { vendors } = useMarketplaceStore.getState();
            const brand = vendors.find((v: any) => v.id === payload.new.brand_id);
            const enriched = { 
              ...payload.new, 
              brands: brand ? { name: brand.name, logo_url: brand.logo_url } : undefined 
            };
            addReel(enriched as any);
          }
        }
        if (payload.eventType === 'DELETE') {
          removeReel(payload.old.id);
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
              const status = payload.new.status;
              if (status === 'paid') {
                toast.success('Payment Verified! Your order is now live.', { icon: '💰' });
              } else {
                toast(`Order status changed to ${status}`, { icon: '🔄' });
              }
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

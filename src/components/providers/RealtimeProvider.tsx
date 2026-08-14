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
          .select(`*, brands:brands!products_brand_id_fkey(*, universities:universities!brands_university_id_fkey(*))`)
          .order('created_at', { ascending: false });

        if (session?.user) {
          if (userUniId) {
            query = query.or(`owner_id.eq.${session.user.id},visibility_type.eq.global,visibility_type.is.null,university_id.eq.${userUniId},university_id.is.null`);
          } else {
            query = query.or(`owner_id.eq.${session.user.id},visibility_type.eq.global,visibility_type.is.null,university_id.is.null`);
          }
        } else {
          // Anonymous users: Show ABUAD by default + global + legacy
          query = query.or(`visibility_type.eq.global,visibility_type.is.null,university_id.eq.${ABUAD_ID},university_id.is.null`);
        }

        let { data: prodData, error: prodError } = await query;
        if (prodError) throw prodError;

        // Fallback: If university-restricted query returns zero products, fetch all products
        if (!prodData || prodData.length === 0) {
          const fallbackQuery = await supabase
            .from('products')
            .select(`*, brands:brands!products_brand_id_fkey(*, universities:universities!brands_university_id_fkey(*))`)
            .order('created_at', { ascending: false });
          prodData = fallbackQuery.data;
        }

        if (active && prodData) {
          const enriched = prodData.map((p: any) => ({
            ...p,
            rating: p.rating || 5,
            reviews: p.reviews_count || 0,
            wishlist_count: 0
          }));
          setProducts(enriched);
        }

        // Brands (Vendors) - include matching uni, null/legacy, or global
        let brandQuery = supabase.from('brands').select('*');
        if (userUniId) {
          brandQuery = brandQuery.or(`university_id.eq.${userUniId},university_id.is.null`);
        } else {
          brandQuery = brandQuery.or(`university_id.eq.${ABUAD_ID},university_id.is.null`);
        }
        let { data: brandData, error: bErr } = await brandQuery;
        if (bErr) throw bErr;

        if (!brandData || brandData.length === 0) {
          const allBrandsRes = await supabase.from('brands').select('*');
          brandData = allBrandsRes.data;
        }

        if (active && brandData) setVendors(brandData as any);

        // Canonical Reels
        let reelQuery = supabase
          .from('reels')
          .select('*, brands(name, logo_url, verified), reel_products(products(*)), reel_likes(id, user_id), reel_comments(id, content, created_at, user_id)')
          .eq('status', 'published')
          .order('created_at', { ascending: false });

        if (userUniId) {
          reelQuery = reelQuery.or(`visibility_type.eq.all,visibility_type.eq.public,and(visibility_type.eq.university,university_id.eq.${userUniId})`);
        } else {
          reelQuery = reelQuery.or(`visibility_type.eq.all,visibility_type.eq.public,visibility_type.eq.university`);
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

    // Always re-fetch canonical reels
    const fetchReels = async () => {
      const { data: reelData } = await supabase
        .from('reels')
        .select('*, brands(name, logo_url, verified), reel_products(products(*)), reel_likes(id, user_id), reel_comments(id, content, created_at, user_id)')
        .eq('status', 'published')
        .order('created_at', { ascending: false });
      if (active && reelData) setReels(reelData as any);
    };

    if (!isInitialized) {
      fetchInitialData();
    } else {
      fetchReels();
    }

    // We bind a single global channel for public tables
    const publicChannel = supabase.channel('public:marketplace');

    // --- PRODUCTS SYNC ---
    publicChannel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'products' },
      async (payload: any) => {
        if (payload.eventType === 'INSERT') {
          const { data: { session } } = await supabase.auth.getSession();
          const userId = session?.user?.id;
          
          // Add to store if it belongs to user OR matches discovery filters
          // Discovery pages will handle the section-based filtering.
          const isOwnProduct = userId && payload.new.owner_id === userId;
          
          // For simplicity, we add it to the store. 
          // If it shouldn't be visible to this specific user (wrong uni), 
          // they'll see it temporarily or it'll be filtered out on next refresh.
          // But for vendors, it ensures instant visibility.
          const { vendors } = useMarketplaceStore.getState();
          const brand = vendors.find((v: any) => v.id === payload.new.brand_id);
          const enriched = { ...payload.new, brands: brand };

          addProduct(enriched as any);
          
          if (isOwnProduct) {
            toast.success(`Product Live: ${payload.new.title}!`);
          } else if (payload.new.product_section !== 'delicacies') {
             // Only toast for new fashion products for other users
             toast.success(`New Arrival: ${payload.new.title}!`);
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
      { event: '*', schema: 'public', table: 'reels' },
      async (payload: any) => {
        if (payload.eventType === 'INSERT' && payload.new.status === 'published') {
          fetchReels();
        }
        if (payload.eventType === 'UPDATE' && payload.new.status === 'published') {
          fetchReels();
        }
        if (payload.eventType === 'DELETE' || payload.new?.status === 'deleted') {
          removeReel(payload.old?.id || payload.new?.id);
        }
      }
    );

    publicChannel.subscribe();

    // --- PRIVATE (AUTHED) SYNC ---
    let privateChannel: any;
    let deliveriesChannel: any;

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

        deliveriesChannel = supabase.channel(`private:deliveries:${session.user.id}`);
        deliveriesChannel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'deliveries' },
          (payload: any) => {
            if (payload.eventType === 'UPDATE') {
              const delivery = payload.new;
              const { orders } = useMarketplaceStore.getState();
              const existingOrder = orders.find((o: any) => o.id === delivery.order_id);
              if (existingOrder) {
                const fetchAgentAvatar = async () => {
                  let avatarUrl = undefined;
                  if (delivery.agent_id) {
                    const { data: userData } = await supabase
                      .from('users')
                      .select('avatar_url')
                      .eq('id', delivery.agent_id)
                      .single();
                    if (userData) {
                      avatarUrl = userData.avatar_url;
                    }
                  }

                  const updatedDelivery = {
                    id: delivery.id,
                    status: delivery.status,
                    agent_id: delivery.agent_id,
                    delivery_code: delivery.delivery_code,
                    agent_name: delivery.agent_name,
                    agent_phone: delivery.agent_phone,
                    users: delivery.agent_id ? {
                      id: delivery.agent_id,
                      name: delivery.agent_name || delivery.rider_name,
                      phone: delivery.agent_phone || delivery.rider_phone,
                      avatar_url: avatarUrl
                    } : null
                  };

                  // Merge into existing deliveries array
                  updateOrder(delivery.order_id, {
                    deliveries: [updatedDelivery]
                  });
                };
                
                fetchAgentAvatar().then(() => {
                  toast('Delivery status updated!', { icon: '🛵' });
                });
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
      if (deliveriesChannel) supabase.removeChannel(deliveriesChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addProduct, addOrder, addReel, addService, addVendor, removeProduct, removeReel, removeService, setInitialized, setOrders, setProducts, setReels, setServices, setVendors, updateOrder, updateProduct, updateService, updateVendor]);

  return (
    <>
      <Toaster position="top-right" />
      {children}
    </>
  );
}

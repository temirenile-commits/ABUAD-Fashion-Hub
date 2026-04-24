-- ABUAD FASHION HUB: MASTER LOGISTICS AND COMMUNITY SYNC
-- Run this in your Supabase SQL Editor to activate ALL features safely.

-- 1. EXTEND USER ROLES & STATUS
DO $$
BEGIN
    -- Update Roles
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check') THEN
        ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('customer', 'vendor', 'admin', 'delivery'));
    ELSE
        ALTER TABLE public.users DROP CONSTRAINT users_role_check;
        ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('customer', 'vendor', 'admin', 'delivery'));
    END IF;

    -- Add Status Column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'status') THEN
        ALTER TABLE public.users ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'deactivated', 'suspended'));
    END IF;
END $$;

-- 2. CORE TABLES
-- Wishlists
CREATE TABLE IF NOT EXISTS public.wishlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, product_id)
);

-- Reviews
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Follows
CREATE TABLE IF NOT EXISTS public.follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(follower_id, brand_id)
);

-- Delivery Agents
CREATE TABLE IF NOT EXISTS public.delivery_agents (
    id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT FALSE,
    current_lat DECIMAL(9,6),
    current_long DECIMAL(9,6),
    current_location_name TEXT,
    wallet_balance DECIMAL DEFAULT 0.00,
    batch_capacity INTEGER DEFAULT 10 CHECK (batch_capacity >= 10 AND batch_capacity <= 50),
    total_deliveries INTEGER DEFAULT 0,
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. SCHEMA ENHANCEMENTS
-- Add columns to Products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS rating DECIMAL DEFAULT 5.0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS reviews_count INTEGER DEFAULT 0;

-- Add columns to Brands
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS rating DECIMAL DEFAULT 5.0;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS reviews_count INTEGER DEFAULT 0;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS reviews INTEGER DEFAULT 0;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;

-- Add columns to Deliveries
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES public.users(id);
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'picked_up', 'delivered', 'cancelled'));
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS pickup_code TEXT;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS delivery_code TEXT;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL DEFAULT 500.00;

-- Ensure Order constraints
-- First, update any existing orders that don't match the new constraint
UPDATE public.orders SET delivery_method = 'platform' WHERE delivery_method != 'platform';

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_delivery_method_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_delivery_method_check CHECK (delivery_method = 'platform');

-- 4. RLS AND POLICIES
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own wishlist" ON public.wishlists;
CREATE POLICY "Users can manage own wishlist" ON public.wishlists FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view reviews" ON public.reviews;
CREATE POLICY "Anyone can view reviews" ON public.reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own reviews" ON public.reviews;
CREATE POLICY "Users can manage own reviews" ON public.reviews FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view follows" ON public.follows;
CREATE POLICY "Anyone can view follows" ON public.follows FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own follows" ON public.follows;
CREATE POLICY "Users can manage own follows" ON public.follows FOR ALL USING (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Agents view own profile" ON public.delivery_agents;
CREATE POLICY "Agents view own profile" ON public.delivery_agents FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Agents update own status" ON public.delivery_agents;
CREATE POLICY "Agents update own status" ON public.delivery_agents FOR UPDATE USING (auth.uid() = id);

-- Notifications Policies
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- 5. AUTOMATED TRIGGERS

-- A. Rating and Review Sync
CREATE OR REPLACE FUNCTION public.sync_ratings_and_reviews()
RETURNS TRIGGER AS $$
DECLARE
    v_product_id UUID;
    v_brand_id UUID;
BEGIN
    v_product_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.product_id ELSE NEW.product_id END;
    SELECT brand_id INTO v_brand_id FROM public.products WHERE id = v_product_id;
    UPDATE public.products SET 
        rating = COALESCE((SELECT AVG(rating) FROM public.reviews WHERE product_id = v_product_id), 5.0),
        reviews_count = (SELECT COUNT(*) FROM public.reviews WHERE product_id = v_product_id)
    WHERE id = v_product_id;
    IF v_brand_id IS NOT NULL THEN
        UPDATE public.brands SET 
            rating = COALESCE((SELECT AVG(rating) FROM public.reviews r JOIN public.products p ON r.product_id = p.id WHERE p.brand_id = v_brand_id), 5.0),
            reviews_count = (SELECT COUNT(*) FROM public.reviews r JOIN public.products p ON r.product_id = p.id WHERE p.brand_id = v_brand_id),
            reviews = (SELECT COUNT(*) FROM public.reviews r JOIN public.products p ON r.product_id = p.id WHERE p.brand_id = v_brand_id)
        WHERE id = v_brand_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_sync_ratings ON public.reviews;
CREATE TRIGGER tr_sync_ratings AFTER INSERT OR UPDATE OR DELETE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.sync_ratings_and_reviews();

-- B. Follower Sync
CREATE OR REPLACE FUNCTION public.sync_brand_followers_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.brands SET followers_count = followers_count + 1 WHERE id = NEW.brand_id;
        INSERT INTO public.notifications (user_id, type, title, content, link)
        SELECT owner_id, 'new_follower', 'New Follower', (SELECT COALESCE(name, 'Someone') FROM public.users WHERE id = NEW.follower_id) || ' started following your brand.', '/dashboard/vendor'
        FROM public.brands WHERE id = NEW.brand_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.brands SET followers_count = GREATEST(0, followers_count - 1) WHERE id = OLD.brand_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_sync_brand_followers ON public.follows;
CREATE TRIGGER tr_sync_brand_followers AFTER INSERT OR DELETE ON public.follows FOR EACH ROW EXECUTE FUNCTION public.sync_brand_followers_count();

-- C. Delivery Completion (Payouts and Escrow)
CREATE OR REPLACE FUNCTION public.handle_delivery_completion()
RETURNS TRIGGER AS $$
DECLARE
    v_order_record RECORD;
    v_vendor_earning DECIMAL;
BEGIN
    IF (NEW.status = 'delivered' AND OLD.status != 'delivered') THEN
        SELECT * INTO v_order_record FROM public.orders WHERE id = NEW.order_id;
        IF NEW.agent_id IS NOT NULL THEN
            UPDATE public.delivery_agents SET wallet_balance = wallet_balance + 500.00, total_deliveries = total_deliveries + 1 WHERE id = NEW.agent_id;
            INSERT INTO public.transactions (user_id, order_id, type, amount, status, description) VALUES (NEW.agent_id, NEW.order_id, 'payout', 500.00, 'success', 'Delivery payout');
        END IF;
        IF v_order_record.id IS NOT NULL THEN
            v_vendor_earning := v_order_record.vendor_earning;
            UPDATE public.wallets SET available_balance = available_balance + v_vendor_earning, pending_balance = pending_balance - v_vendor_earning WHERE brand_id = v_order_record.brand_id;
            UPDATE public.orders SET status = 'delivered', delivered_at = now() WHERE id = NEW.order_id;
            INSERT INTO public.transactions (brand_id, order_id, type, amount, status, description) VALUES (v_order_record.brand_id, NEW.order_id, 'escrow_release', v_vendor_earning, 'success', 'Automatic release');
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_delivery_completed ON public.deliveries;
CREATE TRIGGER on_delivery_completed AFTER UPDATE ON public.deliveries FOR EACH ROW EXECUTE FUNCTION public.handle_delivery_completion();

-- 6. FINAL CACHE REFRESH
NOTIFY pgrst, 'reload schema';
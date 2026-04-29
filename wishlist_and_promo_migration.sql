-- Phase 4: Wishlist & Promotions Migration

-- 1. Create Wishlists Table
CREATE TABLE IF NOT EXISTS public.wishlists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) NOT NULL,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, product_id)
);

ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own wishlist." 
ON public.wishlists FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own wishlist." 
ON public.wishlists FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- 2. Enhance Products for Promotions
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_flash_sale BOOLEAN DEFAULT FALSE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS flash_sale_price DECIMAL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_billboard BOOLEAN DEFAULT FALSE;

-- 3. Enhance Brands for Billboard Boost
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS billboard_boost_expires_at TIMESTAMP WITH TIME ZONE;

-- 4. Create Follows Table if missing (based on VendorActions.tsx)
CREATE TABLE IF NOT EXISTS public.follows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID REFERENCES public.users(id) NOT NULL,
  brand_id UUID REFERENCES public.brands(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(follower_id, brand_id)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Follows are viewable by everyone." 
ON public.follows FOR SELECT 
USING (true);

CREATE POLICY "Users can manage their own follows." 
ON public.follows FOR ALL 
USING (auth.uid() = follower_id) 
WITH CHECK (auth.uid() = follower_id);

-- 5. Storage policies for new buckets if any
INSERT INTO storage.buckets (id, name, public) VALUES ('promo-banners', 'promo-banners', true) ON CONFLICT (id) DO UPDATE SET public = true;
CREATE POLICY "Public Access Promo" ON storage.objects FOR SELECT USING ( bucket_id = 'promo-banners' );

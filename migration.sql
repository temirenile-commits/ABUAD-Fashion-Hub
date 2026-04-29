-- RUN THIS IN YOUR SUPABASE SQL EDITOR TO CREATE VIDEO-SPECIFIC BUCKETS

-- 1. Create product-videos bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-videos', 'product-videos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Create brand-reels bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('brand-reels', 'brand-reels', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Allow public access to product-videos
DROP POLICY IF EXISTS "Public Access for product-videos" ON storage.objects;
CREATE POLICY "Public Access for product-videos" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'product-videos');

-- 4. Allow authenticated users to upload to product-videos
DROP POLICY IF EXISTS "Auth Upload for product-videos" ON storage.objects;
CREATE POLICY "Auth Upload for product-videos" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'product-videos' AND auth.role() = 'authenticated');

-- 5. Allow public access to brand-reels
DROP POLICY IF EXISTS "Public Access for brand-reels" ON storage.objects;
CREATE POLICY "Public Access for brand-reels" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'brand-reels');

-- 6. Allow authenticated users to upload to brand-reels
DROP POLICY IF EXISTS "Auth Upload for brand-reels" ON storage.objects;
CREATE POLICY "Auth Upload for brand-reels" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'brand-reels' AND auth.role() = 'authenticated');

-- 7. Add expiration to orders for 30-min window
ALTER TABLE orders ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- 8. Promo Codes Table (Updated)
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID REFERENCES public.brands(id),
  product_id UUID REFERENCES public.products(id), 
  code TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL DEFAULT 'percentage' CHECK (type IN ('percentage', 'fixed')),
  value DECIMAL NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  current_uses INTEGER DEFAULT 0,
  max_uses INTEGER DEFAULT 100,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Promo codes are viewable by everyone." ON public.promo_codes;
CREATE POLICY "Promo codes are viewable by everyone." ON public.promo_codes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Vendors manage own promo codes." ON public.promo_codes;
CREATE POLICY "Vendors manage own promo codes." ON public.promo_codes FOR ALL USING (EXISTS (SELECT 1 FROM public.brands WHERE id = brand_id AND owner_id = auth.uid()));

ALTER TABLE brands ADD COLUMN IF NOT EXISTS profile_views INT DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_discount DECIMAL(10,2) DEFAULT 0;

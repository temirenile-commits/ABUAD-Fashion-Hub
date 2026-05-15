-- MASTER CART MARKETPLACE SEGMENTATION MIGRATION
-- Run this in your Supabase SQL Editor to enforce strict isolation between Fashion and Delicacies

-- 1. Extend Products table with section metadata
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS product_section TEXT DEFAULT 'fashion' CHECK (product_section IN ('fashion', 'delicacies')),
ADD COLUMN IF NOT EXISTS delicacy_category TEXT;

-- Create index for faster marketplace filtering
CREATE INDEX IF NOT EXISTS idx_products_section ON public.products(product_section);

-- 2. Extend Brand Reels table with section metadata
ALTER TABLE public.brand_reels 
ADD COLUMN IF NOT EXISTS product_section TEXT DEFAULT 'fashion' CHECK (product_section IN ('fashion', 'delicacies'));

-- Create index for faster video filtering
CREATE INDEX IF NOT EXISTS idx_reels_section ON public.brand_reels(product_section);

-- 3. Create Storage Buckets for Delicacies Assets (Ensuring physical isolation)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('delicacies-media', 'delicacies-media', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('delicacies-videos', 'delicacies-videos', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Enable Public Access for the new buckets
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND policyname = 'Public Access for Delicacies Media'
    ) THEN
        CREATE POLICY "Public Access for Delicacies Media" ON storage.objects FOR SELECT 
        USING ( bucket_id IN ('delicacies-media', 'delicacies-videos') );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND policyname = 'Vendors can upload delicacies'
    ) THEN
        CREATE POLICY "Vendors can upload delicacies" ON storage.objects FOR INSERT 
        WITH CHECK ( bucket_id IN ('delicacies-media', 'delicacies-videos') AND auth.role() = 'authenticated' );
    END IF;
END $$;

-- 5. Data Migration (Optional: move existing food items if any)
-- UPDATE public.products SET product_section = 'delicacies' WHERE category ILIKE '%food%' OR category ILIKE '%drink%' OR category ILIKE '%snack%';

-- 6. Add University Scoping to Promo Codes (Fix for previous error)
ALTER TABLE public.promo_codes 
ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES public.universities(id);

CREATE INDEX IF NOT EXISTS idx_promo_codes_uni ON public.promo_codes(university_id);

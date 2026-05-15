-- 1. Add product_section to brand_reels for strict isolation
ALTER TABLE public.brand_reels 
ADD COLUMN IF NOT EXISTS product_section TEXT DEFAULT 'fashion' CHECK (product_section IN ('fashion', 'delicacies'));

-- 2. Update existing reels based on vendor type (if possible, otherwise default to fashion)
UPDATE public.brand_reels r
SET product_section = 'delicacies'
FROM public.brands b
WHERE r.brand_id = b.id AND b.marketplace_type = 'delicacies';

-- 3. Create index for performance
CREATE INDEX IF NOT EXISTS idx_brand_reels_section ON public.brand_reels(product_section);

-- 4. Ensure storage policies cover the new buckets created in previous step
-- (Already handled in 20260515_delicacies_isolation.sql)

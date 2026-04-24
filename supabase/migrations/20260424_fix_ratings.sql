-- Migration: Fix Ratings & Reviews Sync (2026-04-24)
-- This ensures that product and brand ratings are automatically updated when reviews are added/removed.

-- 1. Ensure columns exist on products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS rating DECIMAL DEFAULT 5.0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS reviews_count INTEGER DEFAULT 0;

-- 2. Ensure columns exist on brands
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS rating DECIMAL DEFAULT 5.0;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS reviews_count INTEGER DEFAULT 0;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS reviews INTEGER DEFAULT 0; -- Alias for frontend compatibility

-- 3. Automated Rating Sync Function
CREATE OR REPLACE FUNCTION public.sync_ratings_and_reviews()
RETURNS TRIGGER AS $$
DECLARE
    v_product_id UUID;
    v_brand_id UUID;
BEGIN
    -- Set target product
    v_product_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.product_id ELSE NEW.product_id END;
    
    -- Get brand_id from product
    SELECT brand_id INTO v_brand_id FROM public.products WHERE id = v_product_id;

    -- Update Product Stats
    UPDATE public.products
    SET 
        rating = COALESCE((SELECT AVG(rating) FROM public.reviews WHERE product_id = v_product_id), 5.0),
        reviews_count = (SELECT COUNT(*) FROM public.reviews WHERE product_id = v_product_id)
    WHERE id = v_product_id;

    -- Update Brand Stats (Average of all product ratings for this brand)
    IF v_brand_id IS NOT NULL THEN
        UPDATE public.brands
        SET 
            rating = COALESCE((
                SELECT AVG(rating) 
                FROM public.reviews r 
                JOIN public.products p ON r.product_id = p.id 
                WHERE p.brand_id = v_brand_id
            ), 5.0),
            reviews_count = (
                SELECT COUNT(*) 
                FROM public.reviews r 
                JOIN public.products p ON r.product_id = p.id 
                WHERE p.brand_id = v_brand_id
            ),
            reviews = (
                SELECT COUNT(*) 
                FROM public.reviews r 
                JOIN public.products p ON r.product_id = p.id 
                WHERE p.brand_id = v_brand_id
            )
        WHERE id = v_brand_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Apply Trigger to Reviews Table
DROP TRIGGER IF EXISTS tr_sync_ratings ON public.reviews;
CREATE TRIGGER tr_sync_ratings
    AFTER INSERT OR UPDATE OR DELETE ON public.reviews
    FOR EACH ROW EXECUTE FUNCTION public.sync_ratings_and_reviews();

-- 5. Recalculate everything once
DO $$
DECLARE
    p RECORD;
    b RECORD;
BEGIN
    -- Recalculate Products
    FOR p IN SELECT id FROM public.products LOOP
        UPDATE public.products
        SET 
            rating = COALESCE((SELECT AVG(rating) FROM public.reviews WHERE product_id = p.id), 5.0),
            reviews_count = (SELECT COUNT(*) FROM public.reviews WHERE product_id = p.id)
        WHERE id = p.id;
    END LOOP;

    -- Recalculate Brands
    FOR b IN SELECT id FROM public.brands LOOP
        UPDATE public.brands
        SET 
            rating = COALESCE((
                SELECT AVG(rating) 
                FROM public.reviews r 
                JOIN public.products p ON r.product_id = p.id 
                WHERE p.brand_id = b.id
            ), 5.0),
            reviews_count = (
                SELECT COUNT(*) 
                FROM public.reviews r 
                JOIN public.products p ON r.product_id = p.id 
                WHERE p.brand_id = b.id
            ),
            reviews = (
                SELECT COUNT(*) 
                FROM public.reviews r 
                JOIN public.products p ON r.product_id = p.id 
                WHERE p.brand_id = b.id
            )
        WHERE id = b.id;
    END LOOP;
END $$;

-- Migration: Wishlists & Reviews (2026-04-24)

-- 1. Create Wishlists Table
CREATE TABLE IF NOT EXISTS public.wishlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, product_id)
);

-- 2. Create Reviews Table
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable RLS
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- 4. Policies
DROP POLICY IF EXISTS "Users can manage their own wishlist" ON public.wishlists;
CREATE POLICY "Users can manage their own wishlist" ON public.wishlists
    FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view reviews" ON public.reviews;
CREATE POLICY "Anyone can view reviews" ON public.reviews
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage their own reviews" ON public.reviews;
CREATE POLICY "Users can manage their own reviews" ON public.reviews
    FOR ALL USING (auth.uid() = user_id);

-- 5. Notification Trigger for Wishlist
CREATE OR REPLACE FUNCTION public.handle_wishlist_notification()
RETURNS TRIGGER AS $$
DECLARE
    v_vendor_id UUID;
    v_product_title TEXT;
    v_vendor_owner_id UUID;
BEGIN
    -- Get product details and brand owner
    SELECT b.id, p.title, b.owner_id 
    INTO v_vendor_id, v_product_title, v_vendor_owner_id 
    FROM public.products p
    JOIN public.brands b ON p.brand_id = b.id
    WHERE p.id = NEW.product_id;
    
    -- Insert notification for vendor
    IF v_vendor_owner_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, content, url)
        VALUES (
            v_vendor_owner_id, 
            '💖 New Wishlist!', 
            'Someone added "' || v_product_title || '" to their wishlist.', 
            '/dashboard/vendor'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_wishlist_added ON public.wishlists;
CREATE TRIGGER on_wishlist_added
    AFTER INSERT ON public.wishlists
    FOR EACH ROW EXECUTE FUNCTION public.handle_wishlist_notification();

-- 6. Add Rating Helper View (Optional but good for real-time stats)
CREATE OR REPLACE VIEW public.product_stats AS
SELECT 
    p.id as product_id,
    COALESCE(AVG(r.rating), 0)::NUMERIC(2,1) as avg_rating,
    COUNT(r.id) as review_count,
    COUNT(w.id) as wishlist_count
FROM public.products p
LEFT JOIN public.reviews r ON p.id = r.product_id
LEFT JOIN public.wishlists w ON p.id = w.product_id
GROUP BY p.id;

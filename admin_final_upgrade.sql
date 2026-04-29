-- Admin Final Upgrade & Fixes

-- 1. Fix Notifications Table (Ensuring 'type' column exists for categorizing notices)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'platform_notice' NOT NULL;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS action_link TEXT;

-- 2. Sub-Admin Granular Permissions
-- Permissions will be stored as JSONB: ['payouts', 'customer_service', 'delivery', 'promotions', 'orders', 'verification', 'reviews']
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS admin_permissions JSONB DEFAULT '[]'::jsonb;

-- 3. Reset Market Reviews Function
-- Sets all product ratings to 0 and average ratings for brands to 0
CREATE OR REPLACE FUNCTION public.reset_all_market_reviews()
RETURNS VOID AS $$
BEGIN
    -- Delete all reviews
    DELETE FROM public.reviews;
    
    -- Reset product views and ratings
    UPDATE public.products SET views_count = 0, sales_count = 0;
    
    -- Reset brand ratings and scores
    UPDATE public.brands SET avg_rating = 0.0, visibility_score = 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Visibility Boosters Table (Missing Plan)
CREATE TABLE IF NOT EXISTS public.visibility_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL NOT NULL,
    duration_days INTEGER NOT NULL,
    boost_level INTEGER DEFAULT 1
);

INSERT INTO public.visibility_plans (id, name, description, price, duration_days, boost_level)
VALUES 
('visibility_week', '7-Day Spotlight', 'Triple your visibility on the explore page for a week.', 1500, 7, 3),
('visibility_month', '30-Day Dominion', 'Dominate the category rankings for a full month.', 5000, 30, 5)
ON CONFLICT (id) DO UPDATE SET price = EXCLUDED.price;

-- 5. Platform Settings Structure for Feature Toggles
-- We will store feature toggles in platform_settings 'plan_features' key
INSERT INTO public.platform_settings (key, value)
VALUES ('plan_features', '{
    "free": ["whatsapp_chat", "basic_analytics"],
    "quarter": ["whatsapp_chat", "basic_analytics", "verified_badge", "priority_support"],
    "half": ["whatsapp_chat", "advanced_analytics", "verified_badge", "priority_support", "promo_codes", "campus_nudges"],
    "full": ["whatsapp_chat", "advanced_analytics", "verified_badge", "priority_support", "promo_codes", "campus_nudges", "billboard_access"]
}')
ON CONFLICT (key) DO NOTHING;

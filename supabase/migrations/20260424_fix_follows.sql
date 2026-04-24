-- Migration: Fix Follows System (2026-04-24)
-- This ensures the follows table exists with correct RLS and automated counters.

-- 1. Create Follows Table
CREATE TABLE IF NOT EXISTS public.follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(follower_id, brand_id)
);

-- 2. Add followers_count to brands if missing
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;

-- 3. Enable RLS
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- 4. Policies
DROP POLICY IF EXISTS "Anyone can view follows" ON public.follows;
CREATE POLICY "Anyone can view follows" ON public.follows
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage their own follows" ON public.follows;
CREATE POLICY "Users can manage their own follows" ON public.follows
    FOR ALL USING (auth.uid() = follower_id);

-- 5. Automated Follower Counter Function
CREATE OR REPLACE FUNCTION public.sync_brand_followers_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.brands 
        SET followers_count = followers_count + 1 
        WHERE id = NEW.brand_id;
        
        -- Send Notification to Vendor
        INSERT INTO public.notifications (user_id, type, title, content, link)
        SELECT 
            owner_id, 
            'new_follower', 
            'New Follower! 🚀', 
            (SELECT COALESCE(name, 'Someone') FROM public.users WHERE id = NEW.follower_id) || ' started following your brand.',
            '/dashboard/vendor'
        FROM public.brands WHERE id = NEW.brand_id;

    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.brands 
        SET followers_count = GREATEST(0, followers_count - 1) 
        WHERE id = OLD.brand_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Apply Trigger
DROP TRIGGER IF EXISTS tr_sync_brand_followers ON public.follows;
CREATE TRIGGER tr_sync_brand_followers
    AFTER INSERT OR DELETE ON public.follows
    FOR EACH ROW EXECUTE FUNCTION public.sync_brand_followers_count();

-- 7. Recalculate all counts once to ensure accuracy
UPDATE public.brands b
SET followers_count = (
    SELECT count(*) 
    FROM public.follows f 
    WHERE f.brand_id = b.id
);

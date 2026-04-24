-- Migration: Create Notifications Table
-- Description: Standardizes the notifications system and enables RLS.

-- 1. Create Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    type TEXT DEFAULT 'general', -- e.g., 'order_update', 'price_drop', 'wishlist'
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    link TEXT, -- Changed from 'url' to 'link' to match frontend expectations
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" 
ON public.notifications FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications" 
ON public.notifications FOR UPDATE 
USING (auth.uid() = user_id);

-- System can insert notifications (for triggers/webhooks)
DROP POLICY IF EXISTS "Triggers can insert notifications" ON public.notifications;
CREATE POLICY "Triggers can insert notifications" 
ON public.notifications FOR INSERT 
WITH CHECK (true); 

-- 4. Indexes
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON public.notifications(created_at);

-- 5. Update Wishlist Trigger to use 'link' instead of 'url'
CREATE OR REPLACE FUNCTION public.handle_wishlist_notification()
RETURNS TRIGGER AS $$
DECLARE
    v_vendor_owner_id UUID;
    v_product_title TEXT;
BEGIN
    -- Get the vendor's owner_id and product title
    SELECT b.owner_id, p.title 
    INTO v_vendor_owner_id, v_product_title
    FROM public.products p
    JOIN public.brands b ON p.brand_id = b.id
    WHERE p.id = NEW.product_id;
    
    -- Insert notification for vendor
    IF v_vendor_owner_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, content, link, type)
        VALUES (
            v_vendor_owner_id, 
            '💖 New Wishlist!', 
            'Someone added "' || v_product_title || '" to their wishlist.', 
            '/dashboard/vendor',
            'wishlist'
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

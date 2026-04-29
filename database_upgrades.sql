-- Notification System Wiring
-- This table should already exist based on NotificationContext.tsx
-- CREATE TABLE IF NOT EXISTS public.notifications (
--   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
--   user_id UUID REFERENCES public.users(id),
--   title TEXT,
--   content TEXT,
--   link TEXT,
--   is_read BOOLEAN DEFAULT FALSE,
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
-- );

-- Add avg_rating to brands if missing
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS avg_rating DECIMAL DEFAULT 5.0;

-- Function to recalculate ratings for all vendors
CREATE OR REPLACE FUNCTION public.recalculate_vendor_ratings()
RETURNS void AS $$
BEGIN
    UPDATE public.brands b
    SET avg_rating = COALESCE(
        (SELECT AVG(rating) FROM public.reviews r WHERE r.brand_id = b.id),
        5.0
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update rating on new review
CREATE OR REPLACE FUNCTION public.update_brand_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.brands
    SET avg_rating = (SELECT AVG(rating) FROM public.reviews WHERE brand_id = NEW.brand_id)
    WHERE id = NEW.brand_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_review_added ON public.reviews;
CREATE TRIGGER on_review_added
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.update_brand_rating();

-- Real-time notification for Order trends (Sales spikes)
-- Note: Simplified logic for demonstration
CREATE OR REPLACE FUNCTION public.notify_vendor_on_order()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.notifications (user_id, title, content, link)
    SELECT owner_id, '💰 New Sale!', 'You just received a new order for ₦' || NEW.total_amount, '/dashboard/vendor'
    FROM public.brands WHERE id = NEW.brand_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_order_paid ON public.orders;
CREATE TRIGGER on_order_paid
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
WHEN (NEW.status = 'paid' AND OLD.status != 'paid')
EXECUTE FUNCTION public.notify_vendor_on_order();

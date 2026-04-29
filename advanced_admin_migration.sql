-- Advanced Admin & Logistics Migration

-- 1. Ensure platform_settings has a policy field
-- (Assuming platform_settings table exists with key and value columns)
INSERT INTO public.platform_settings (key, value) 
VALUES ('platform_policy', '{"last_updated": "2026-04-29", "sections": []}')
ON CONFLICT (key) DO NOTHING;

-- 2. Enhance Delivery Agents with tracking fields
ALTER TABLE public.delivery_agents
ADD COLUMN IF NOT EXISTS total_earnings DECIMAL DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS completed_orders_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_batch_count INTEGER DEFAULT 0;

-- 3. Add Account Powers to Users
-- We will use the 'role' column for basic roles, but can add 'admin_permissions' for granular control
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS admin_permissions JSONB DEFAULT '[]'::jsonb;

-- 4. Create a function to reset ANY vendor to free tier
CREATE OR REPLACE FUNCTION public.reset_account_to_free(p_brand_id UUID)
RETURNS VOID AS $$
DECLARE
    free_limits JSONB;
BEGIN
    SELECT value INTO free_limits FROM public.platform_settings WHERE key = 'free_tier_limits';
    
    UPDATE public.brands 
    SET 
        subscription_tier = 'free',
        max_products = (free_limits->>'max_products')::INTEGER,
        max_reels = (free_limits->>'max_reels')::INTEGER,
        subscription_expires_at = NULL,
        verified = TRUE,
        fee_paid = TRUE
    WHERE id = p_brand_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

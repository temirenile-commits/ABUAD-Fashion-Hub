-- MIGRATION: Delivery Agent System & Automated Logistics
-- 2026-04-24

-- 1. EXTEND USER ROLES
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check') THEN
        ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('customer', 'vendor', 'admin', 'delivery'));
    ELSE
        ALTER TABLE public.users DROP CONSTRAINT users_role_check;
        ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('customer', 'vendor', 'admin', 'delivery'));
    END IF;
END $$;

-- 2. DELIVERY AGENTS TABLE
CREATE TABLE IF NOT EXISTS public.delivery_agents (
    id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT FALSE,
    current_lat DECIMAL(9,6),
    current_long DECIMAL(9,6),
    current_location_name TEXT,
    wallet_balance DECIMAL DEFAULT 0.00,
    batch_capacity INTEGER DEFAULT 10 CHECK (batch_capacity >= 10 AND batch_capacity <= 50),
    total_deliveries INTEGER DEFAULT 0,
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.delivery_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view their own profile" ON public.delivery_agents
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Agents can update their own status/location" ON public.delivery_agents
    FOR UPDATE USING (auth.uid() = id);

-- 3. ENHANCE DELIVERIES TABLE
ALTER TABLE public.deliveries 
ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES public.users(id),
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'picked_up', 'delivered', 'cancelled')),
ADD COLUMN IF NOT EXISTS pickup_code TEXT,
ADD COLUMN IF NOT EXISTS delivery_code TEXT,
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL DEFAULT 500.00;

-- 4. DELIVERY WALLET RPC (For Payouts)
CREATE OR REPLACE FUNCTION public.adjust_agent_wallet(
    p_agent_id UUID,
    p_delta DECIMAL
) RETURNS VOID AS $$
BEGIN
    UPDATE public.delivery_agents
    SET wallet_balance = wallet_balance + p_delta,
        total_deliveries = CASE WHEN p_delta > 0 THEN total_deliveries + 1 ELSE total_deliveries END
    WHERE id = p_agent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. VENDOR WALLET RPC (Escrow Release)
-- Assuming a 'wallets' table exists with available_balance and pending_balance
CREATE OR REPLACE FUNCTION public.adjust_vendor_wallet(
    p_brand_id UUID,
    p_available_delta DECIMAL DEFAULT 0,
    p_pending_delta DECIMAL DEFAULT 0
) RETURNS VOID AS $$
BEGIN
    UPDATE public.wallets
    SET available_balance = available_balance + p_available_delta,
        pending_balance = pending_balance + p_pending_delta
    WHERE brand_id = p_brand_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. AUTOMATED LOGISTICS TRIGGER
-- This handles: 1. Paying the Agent, 2. Releasing Vendor Funds, 3. Updating Order Status
CREATE OR REPLACE FUNCTION public.handle_delivery_completion()
RETURNS TRIGGER AS $$
DECLARE
    v_order_record RECORD;
    v_vendor_earning DECIMAL;
    v_agent_payout DECIMAL;
    v_settings_record RECORD;
BEGIN
    -- Only trigger when status changes to 'delivered'
    IF (NEW.status = 'delivered' AND OLD.status != 'delivered') THEN
        
        -- 1. Fetch Order Details
        SELECT * INTO v_order_record FROM public.orders WHERE id = NEW.order_id;

        -- 2. Fetch Payout Setting
        SELECT (value::text)::DECIMAL INTO v_agent_payout 
        FROM public.platform_settings 
        WHERE key = 'delivery_agent_payout';
        
        IF v_agent_payout IS NULL THEN v_agent_payout := 500.00; END IF;
        
        -- 3. PAY THE DELIVERY AGENT
        IF NEW.agent_id IS NOT NULL THEN
            PERFORM public.adjust_agent_wallet(NEW.agent_id, v_agent_payout);
            
            -- Log Agent Transaction
            INSERT INTO public.transactions (user_id, order_id, type, amount, status, description)
            VALUES (NEW.agent_id, NEW.order_id, 'payout', v_agent_payout, 'success', 'Delivery payout for Order #' || substring(NEW.order_id::text, 1, 8));
        END IF;

        -- 4. RELEASE FUNDS TO VENDOR
        -- Move vendor_earning from Pending to Available
        IF v_order_record.id IS NOT NULL THEN
            v_vendor_earning := v_order_record.vendor_earning;
            
            PERFORM public.adjust_vendor_wallet(v_order_record.brand_id, v_vendor_earning, -v_vendor_earning);
            
            -- Update Order Status to 'delivered' in the main orders table
            UPDATE public.orders 
            SET status = 'delivered', 
                delivered_at = timezone('utc'::text, now())
            WHERE id = NEW.order_id;

            -- Log Vendor Transaction
            INSERT INTO public.transactions (brand_id, order_id, type, amount, status, description)
            VALUES (v_order_record.brand_id, NEW.order_id, 'escrow_release', v_vendor_earning, 'success', 'Automatic funds release via delivery confirmation');
            
            -- Create Notification for Vendor
            INSERT INTO public.notifications (user_id, type, title, content, link)
            VALUES (
                (SELECT owner_id FROM public.brands WHERE id = v_order_record.brand_id),
                'payment_received',
                'Payment Released! 💰',
                'Order #' || substring(NEW.order_id::text, 1, 8) || ' has been delivered. Funds are now available.',
                '/dashboard/vendor'
            );
        END IF;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply the trigger
DROP TRIGGER IF EXISTS on_delivery_completed ON public.deliveries;
CREATE TRIGGER on_delivery_completed
    AFTER UPDATE ON public.deliveries
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_delivery_completion();

-- 7. INITIALIZE WALLETS (Optional - just in case they don't exist)
-- CREATE TABLE IF NOT EXISTS public.wallets (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE UNIQUE,
--     available_balance DECIMAL DEFAULT 0,
--     pending_balance DECIMAL DEFAULT 0,
--     updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
-- );

-- 8. RESTRICT DELIVERY METHODS
-- Remove vendor delivery, force platform delivery
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_delivery_method_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_delivery_method_check CHECK (delivery_method = 'platform');

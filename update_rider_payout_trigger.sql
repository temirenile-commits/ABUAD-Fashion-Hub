-- SQL script to update handle_delivery_completion to use dynamic delivery_fee from deliveries table
-- Run this in your Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.handle_delivery_completion()
RETURNS TRIGGER AS $$
DECLARE
    v_order_record RECORD;
    v_vendor_earning DECIMAL;
    v_vendor_user_id UUID;
    v_delivery_fee DECIMAL;
    v_commission_rate DECIMAL := 0.00;
    v_commission_amount DECIMAL := 0.00;
BEGIN
    IF (NEW.status = 'delivered' AND OLD.status != 'delivered') THEN
        SELECT * INTO v_order_record FROM public.orders WHERE id = NEW.order_id;
        
        -- Use the dynamic delivery fee stored in the delivery record, fallback to 500.00
        v_delivery_fee := COALESCE(NEW.delivery_fee, 500.00);
        
        -- Try to fetch commission rate from settings (if it exists)
        BEGIN
            v_commission_rate := COALESCE((current_setting('app.settings.commission_rate', true))::DECIMAL, 0.00);
        EXCEPTION WHEN OTHERS THEN
            v_commission_rate := 0.00;
        END;
        
        -- Agent Flow
        IF NEW.agent_id IS NOT NULL THEN
            UPDATE public.agent_wallets 
            SET pending_balance = pending_balance + v_delivery_fee, 
                total_earnings = total_earnings + v_delivery_fee 
            WHERE agent_id = NEW.agent_id;
            
            UPDATE public.delivery_agents 
            SET total_deliveries = total_deliveries + 1,
                wallet_balance = wallet_balance + v_delivery_fee -- keep for backward compat
            WHERE id = NEW.agent_id;

            INSERT INTO public.escrow_holds (order_id, user_id, user_role, amount, commission_amount, release_date, status)
            VALUES (NEW.order_id, NEW.agent_id, 'delivery', v_delivery_fee, 0, now() + interval '24 hours', 'pending');
        END IF;

        -- Vendor Flow
        IF v_order_record.id IS NOT NULL THEN
            SELECT owner_id INTO v_vendor_user_id FROM public.brands WHERE id = v_order_record.brand_id;
            
            v_commission_amount := (v_order_record.vendor_earning * v_commission_rate) / 100;
            v_vendor_earning := v_order_record.vendor_earning - v_commission_amount;

            UPDATE public.wallets 
            SET pending_balance = pending_balance + v_vendor_earning,
                total_earnings = total_earnings + v_vendor_earning
            WHERE brand_id = v_order_record.brand_id;
            
            -- Keep original order state update
            UPDATE public.orders SET status = 'delivered', delivered_at = now() WHERE id = NEW.order_id;
            
            INSERT INTO public.escrow_holds (order_id, user_id, user_role, amount, commission_amount, release_date, status)
            VALUES (NEW.order_id, v_vendor_user_id, 'vendor', v_vendor_earning, v_commission_amount, now() + interval '24 hours', 'pending');
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notify schema reload
NOTIFY pgrst, 'reload schema';

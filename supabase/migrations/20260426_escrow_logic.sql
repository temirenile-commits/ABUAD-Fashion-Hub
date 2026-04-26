-- Migration: Escrow Logic & Payout RPCs (2026-04-26)

-- 1. FIX ESCROW HOLDS TABLE
ALTER TABLE public.escrow_holds DROP COLUMN IF EXISTS vendor_id CASCADE;
ALTER TABLE public.escrow_holds ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) NOT NULL;
ALTER TABLE public.escrow_holds ADD COLUMN IF NOT EXISTS user_role TEXT NOT NULL CHECK (user_role IN ('vendor', 'delivery'));

-- Drop the old unique constraint if order_id was UNIQUE because now an order has 2 escrows (vendor + agent)
ALTER TABLE public.escrow_holds DROP CONSTRAINT IF EXISTS escrow_holds_order_id_key CASCADE;
-- Add a composite unique constraint instead
ALTER TABLE public.escrow_holds ADD CONSTRAINT escrow_holds_order_role_unique UNIQUE (order_id, user_role);

DROP POLICY IF EXISTS "Vendors view own escrow holds." ON public.escrow_holds;
CREATE POLICY "Users view own escrow holds." ON public.escrow_holds 
FOR SELECT USING (auth.uid() = user_id);

-- 2. UPDATE DELIVERY COMPLETION TRIGGER
CREATE OR REPLACE FUNCTION public.handle_delivery_completion()
RETURNS TRIGGER AS $$
DECLARE
    v_order_record RECORD;
    v_vendor_earning DECIMAL;
    v_vendor_user_id UUID;
    v_delivery_fee DECIMAL := 500.00;
    v_commission_rate DECIMAL := 0.00;
    v_commission_amount DECIMAL := 0.00;
BEGIN
    IF (NEW.status = 'delivered' AND OLD.status != 'delivered') THEN
        SELECT * INTO v_order_record FROM public.orders WHERE id = NEW.order_id;
        
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

-- 3. ESCROW RELEASE RPC
CREATE OR REPLACE FUNCTION public.release_escrow(p_escrow_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_escrow RECORD;
    v_brand_id UUID;
BEGIN
    SELECT * INTO v_escrow FROM public.escrow_holds WHERE id = p_escrow_id AND status = 'pending';
    IF NOT FOUND THEN RETURN FALSE; END IF;

    IF v_escrow.user_role = 'vendor' THEN
        SELECT id INTO v_brand_id FROM public.brands WHERE owner_id = v_escrow.user_id LIMIT 1;
        UPDATE public.wallets 
        SET pending_balance = pending_balance - v_escrow.amount,
            available_balance = available_balance + v_escrow.amount
        WHERE brand_id = v_brand_id;
    ELSIF v_escrow.user_role = 'delivery' THEN
        UPDATE public.agent_wallets 
        SET pending_balance = pending_balance - v_escrow.amount,
            available_balance = available_balance + v_escrow.amount
        WHERE agent_id = v_escrow.user_id;
    END IF;

    UPDATE public.escrow_holds SET status = 'released' WHERE id = p_escrow_id;
    
    INSERT INTO public.financial_ledger (user_id, user_role, type, amount, reference, status, description)
    VALUES (v_escrow.user_id, v_escrow.user_role, 'credit', v_escrow.amount, v_escrow.order_id::text, 'completed', 'Escrow release for order');

    -- Record platform commission if any
    IF v_escrow.commission_amount > 0 THEN
        INSERT INTO public.financial_ledger (user_id, user_role, type, amount, reference, status, description)
        VALUES (v_escrow.user_id, 'platform', 'commission', v_escrow.commission_amount, v_escrow.order_id::text, 'completed', 'Platform commission');
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. PAYOUT REQUEST RPC
CREATE OR REPLACE FUNCTION public.request_payout(p_user_id UUID, p_role TEXT, p_amount DECIMAL, p_bank_details JSONB)
RETURNS UUID AS $$
DECLARE
    v_available DECIMAL;
    v_brand_id UUID;
    v_request_id UUID;
BEGIN
    IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be greater than zero'; END IF;

    IF p_role = 'vendor' THEN
        SELECT id INTO v_brand_id FROM public.brands WHERE owner_id = p_user_id LIMIT 1;
        SELECT available_balance INTO v_available FROM public.wallets WHERE brand_id = v_brand_id;
    ELSIF p_role = 'delivery' THEN
        SELECT available_balance INTO v_available FROM public.agent_wallets WHERE agent_id = p_user_id;
    ELSE
        RAISE EXCEPTION 'Invalid role';
    END IF;

    IF v_available < p_amount THEN
        RAISE EXCEPTION 'Insufficient available balance';
    END IF;

    -- Deduct balance
    IF p_role = 'vendor' THEN
        UPDATE public.wallets SET available_balance = available_balance - p_amount WHERE brand_id = v_brand_id;
    ELSIF p_role = 'delivery' THEN
        UPDATE public.agent_wallets SET available_balance = available_balance - p_amount WHERE agent_id = p_user_id;
    END IF;

    -- Create request
    INSERT INTO public.payout_requests (user_id, role, amount_requested, bank_details, status)
    VALUES (p_user_id, p_role, p_amount, p_bank_details, 'pending')
    RETURNING id INTO v_request_id;

    -- Create pending ledger entry
    INSERT INTO public.financial_ledger (user_id, user_role, type, amount, reference, status, description)
    VALUES (p_user_id, p_role, 'payout', p_amount, v_request_id::text, 'pending', 'Payout request initiated');

    RETURN v_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. CONFIRM PAYOUT RPC
CREATE OR REPLACE FUNCTION public.confirm_payout(p_request_id UUID, p_admin_id UUID, p_proof_url TEXT, p_reference TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_req RECORD;
    v_brand_id UUID;
BEGIN
    SELECT * INTO v_req FROM public.payout_requests WHERE id = p_request_id AND status IN ('pending', 'processing');
    IF NOT FOUND THEN RETURN FALSE; END IF;

    -- Update total withdrawn
    IF v_req.role = 'vendor' THEN
        SELECT id INTO v_brand_id FROM public.brands WHERE owner_id = v_req.user_id LIMIT 1;
        UPDATE public.wallets SET total_withdrawn = total_withdrawn + v_req.amount_requested WHERE brand_id = v_brand_id;
    ELSIF v_req.role = 'delivery' THEN
        UPDATE public.agent_wallets SET total_withdrawn = total_withdrawn + v_req.amount_requested WHERE agent_id = v_req.user_id;
    END IF;

    -- Update Request
    UPDATE public.payout_requests 
    SET status = 'completed', proof_url = p_proof_url, transfer_reference = p_reference, confirmed_by = p_admin_id, confirmed_at = now()
    WHERE id = p_request_id;

    -- Update Ledger
    UPDATE public.financial_ledger SET status = 'completed' WHERE reference = p_request_id::text AND type = 'payout';

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. REJECT PAYOUT RPC
CREATE OR REPLACE FUNCTION public.reject_payout(p_request_id UUID, p_admin_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_req RECORD;
    v_brand_id UUID;
BEGIN
    SELECT * INTO v_req FROM public.payout_requests WHERE id = p_request_id AND status IN ('pending', 'processing');
    IF NOT FOUND THEN RETURN FALSE; END IF;

    -- Restore balance
    IF v_req.role = 'vendor' THEN
        SELECT id INTO v_brand_id FROM public.brands WHERE owner_id = v_req.user_id LIMIT 1;
        UPDATE public.wallets SET available_balance = available_balance + v_req.amount_requested WHERE brand_id = v_brand_id;
    ELSIF v_req.role = 'delivery' THEN
        UPDATE public.agent_wallets SET available_balance = available_balance + v_req.amount_requested WHERE agent_id = v_req.user_id;
    END IF;

    -- Update Request
    UPDATE public.payout_requests SET status = 'rejected', confirmed_by = p_admin_id, confirmed_at = now() WHERE id = p_request_id;

    -- Update Ledger
    UPDATE public.financial_ledger SET status = 'failed', description = 'Payout request rejected' WHERE reference = p_request_id::text AND type = 'payout';

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notify schema reload
NOTIFY pgrst, 'reload schema';

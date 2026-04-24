-- Migration: Vendor Wallet & Payout System (2026-04-24)

-- 1. Update Brands Table for Paystack
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS account_name TEXT;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS recipient_code TEXT;

-- 2. Create Wallets Table
CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    brand_id UUID REFERENCES public.brands(id) NOT NULL UNIQUE,
    available_balance DECIMAL(12,2) DEFAULT 0.00,
    pending_balance DECIMAL(12,2) DEFAULT 0.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Withdrawals Table
CREATE TABLE IF NOT EXISTS public.withdrawals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    brand_id UUID REFERENCES public.brands(id) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
    reference TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable RLS
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

-- 5. Policies
DROP POLICY IF EXISTS "Vendors view own wallet." ON public.wallets;
CREATE POLICY "Vendors view own wallet." ON public.wallets 
FOR SELECT USING (EXISTS (SELECT 1 FROM public.brands WHERE id = brand_id AND owner_id = auth.uid()));

DROP POLICY IF EXISTS "Vendors view own withdrawals." ON public.withdrawals;
CREATE POLICY "Vendors view own withdrawals." ON public.withdrawals 
FOR SELECT USING (EXISTS (SELECT 1 FROM public.brands WHERE id = brand_id AND owner_id = auth.uid()));

-- 6. Wallet Initialization Trigger
CREATE OR REPLACE FUNCTION public.handle_new_brand_wallet()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.wallets (brand_id, available_balance)
    VALUES (NEW.id, COALESCE(NEW.wallet_balance, 0));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_brand_created ON public.brands;
CREATE TRIGGER on_brand_created
AFTER INSERT ON public.brands
FOR EACH ROW EXECUTE FUNCTION public.handle_new_brand_wallet();

-- 7. Initialize wallets for existing brands
INSERT INTO public.wallets (brand_id, available_balance)
SELECT id, COALESCE(wallet_balance, 0) FROM public.brands
ON CONFLICT (brand_id) DO NOTHING;

-- 8. Unified Wallet Adjustment RPC
-- This safely handles moving funds between pending and available
CREATE OR REPLACE FUNCTION public.adjust_vendor_wallet(
    p_brand_id UUID,
    p_available_delta DECIMAL DEFAULT 0,
    p_pending_delta DECIMAL DEFAULT 0
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.wallets
    SET available_balance = available_balance + p_available_delta,
        pending_balance = pending_balance + p_pending_delta,
        updated_at = timezone('utc'::text, now())
    WHERE brand_id = p_brand_id;
    
    -- Sync back to brands table for compatibility (optional but safer for existing code)
    UPDATE public.brands
    SET wallet_balance = (SELECT available_balance FROM public.wallets WHERE brand_id = p_brand_id)
    WHERE id = p_brand_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Backward compatibility redirects
CREATE OR REPLACE FUNCTION public.adjust_brand_wallet(
  p_brand_id UUID,
  p_amount DECIMAL
)
RETURNS VOID AS $$
BEGIN
  PERFORM public.adjust_vendor_wallet(p_brand_id, p_amount, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_vendor_wallet(
  brand_id UUID,
  amount DECIMAL
)
RETURNS VOID AS $$
BEGIN
  PERFORM public.adjust_vendor_wallet(brand_id, amount, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

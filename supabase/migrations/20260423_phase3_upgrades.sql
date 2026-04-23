-- Add missing columns for Phase 3 Media & Targeting
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS last_active TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Add last_active to brands as well for visibility scoring
ALTER TABLE public.brands
ADD COLUMN IF NOT EXISTS last_active TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Ensure wallet_balance is always a decimal with 2 places for precision
ALTER TABLE public.brands
ALTER COLUMN wallet_balance TYPE DECIMAL(12,2);

-- Function to handle atomic wallet updates (Fixing name consistency)
CREATE OR REPLACE FUNCTION public.adjust_brand_wallet(
  p_brand_id UUID,
  p_amount DECIMAL
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.brands
  SET wallet_balance = wallet_balance + p_amount,
      last_active = timezone('utc'::text, now())
  WHERE id = p_brand_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Alias for backward compatibility if RPCs use different names
CREATE OR REPLACE FUNCTION public.increment_vendor_wallet(
  brand_id UUID,
  amount DECIMAL
)
RETURNS VOID AS $$
BEGIN
  PERFORM public.adjust_brand_wallet(brand_id, amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

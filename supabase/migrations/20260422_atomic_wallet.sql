-- Atomic Wallet Adjustment Function
-- Handles increments (earnings) and decrements (withdrawals) safely
CREATE OR REPLACE FUNCTION adjust_brand_wallet(
  p_brand_id UUID,
  p_amount NUMERIC
)
RETURNS VOID AS $$
BEGIN
  UPDATE brands
  SET wallet_balance = wallet_balance + p_amount
  WHERE id = p_brand_id;

  -- Optional: Ensure balance doesn't go negative if we want strict enforcement
  -- IF (SELECT wallet_balance FROM brands WHERE id = p_brand_id) < 0 THEN
  --   RAISE EXCEPTION 'Insufficient wallet balance';
  -- END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Credit System Migration
-- Run in Supabase SQL Editor

-- Function to decrement listing credits
CREATE OR REPLACE FUNCTION decrement_listing_credits(p_brand_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE brands
  SET free_listings_count = GREATEST(0, free_listings_count - 1)
  WHERE id = p_brand_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment listing credits (e.g. on plan purchase)
CREATE OR REPLACE FUNCTION add_listing_credits(p_brand_id UUID, p_count INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE brands
  SET free_listings_count = free_listings_count + p_count
  WHERE id = p_brand_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

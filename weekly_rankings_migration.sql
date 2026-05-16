-- Add weekly sales tracking and award history to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS weekly_sold INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS award_history JSONB DEFAULT '[]';

-- Add weekly order tracking and award history to brands
ALTER TABLE brands ADD COLUMN IF NOT EXISTS weekly_orders INTEGER DEFAULT 0;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS award_history JSONB DEFAULT '[]';

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_products_weekly_sold ON products(weekly_sold DESC);
CREATE INDEX IF NOT EXISTS idx_brands_weekly_orders ON brands(weekly_orders DESC);

-- RPC for atomic increment
CREATE OR REPLACE FUNCTION increment_product_weekly_sold(prod_id UUID, qty INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE products 
  SET weekly_sold = weekly_sold + qty
  WHERE id = prod_id;
END;
$$ LANGUAGE plpgsql;

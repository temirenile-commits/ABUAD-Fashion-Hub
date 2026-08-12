-- MasterCart Live Schema Synchronization Migration
-- Created: 2026-08-12
-- Ensures all required columns and constraints exist across products, brands, and users.

-- 1. Products table synchronization
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' and column_name='product_section') THEN
    ALTER TABLE products ADD COLUMN product_section TEXT DEFAULT 'fashion';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' and column_name='delicacy_category') THEN
    ALTER TABLE products ADD COLUMN delicacy_category TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' and column_name='cafeteria_ids') THEN
    ALTER TABLE products ADD COLUMN cafeteria_ids UUID[];
  END IF;
END $$;

-- Ensure canonical category check constraint on products
ALTER TABLE products DROP CONSTRAINT IF EXISTS product_delicacy_category_check;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_delicacy_category_check;

ALTER TABLE products
  ADD CONSTRAINT products_delicacy_category_check
  CHECK (delicacy_category IN (
    'snacks', 
    'small_chops', 
    'pastries_baked', 
    'drinks_beverages', 
    'provisions', 
    'combo_packages', 
    'frozen_chilled', 
    'seasonal_trending',
    'other',
    NULL
  ));

-- 2. Brands table synchronization
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='brands' and column_name='marketplace_type') THEN
    ALTER TABLE brands ADD COLUMN marketplace_type TEXT DEFAULT 'fashion';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='brands' and column_name='free_listings_count') THEN
    ALTER TABLE brands ADD COLUMN free_listings_count INTEGER DEFAULT 5;
  END IF;
END $$;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

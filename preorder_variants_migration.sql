-- =================================================================================
-- PREORDER & VARIANTS MIGRATION
-- Adds support for product variants, preorder flags, and preorder escrow tracking.
-- Run this script in your Supabase SQL Editor.
-- =================================================================================

-- 1. Update Products Table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_preorder BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS preorder_arrival_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]'::jsonb;

-- 2. Update Orders Table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_preorder BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS preorder_arrival_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS variants_selected JSONB DEFAULT '{}'::jsonb;

-- 3. (Optional) Create an index to quickly find active preorder orders
CREATE INDEX IF NOT EXISTS idx_orders_preorder 
ON public.orders (is_preorder) 
WHERE is_preorder = TRUE;

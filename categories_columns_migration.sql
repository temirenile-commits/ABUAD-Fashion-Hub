-- ====================================================
-- MIGRATION: Add Missing Category Columns
-- Run this in your Supabase SQL Editor
-- This adds 'icon', 'is_active', and 'sort_order' columns
-- to the product_categories table if they were missed.
-- ====================================================

ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT '📦',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;

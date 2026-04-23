-- Phase 3 Schema Expansion: High-Integrity Academic Verification
-- Run this in your Supabase SQL Editor

-- 1. Add missing verification columns to brands table
ALTER TABLE public.brands 
ADD COLUMN IF NOT EXISTS room_number TEXT,
ADD COLUMN IF NOT EXISTS matric_number TEXT,
ADD COLUMN IF NOT EXISTS college TEXT,
ADD COLUMN IF NOT EXISTS department TEXT;

-- 2. Add subscription tracking columns
ALTER TABLE public.brands
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS max_products INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_reels INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITH TIME ZONE;

-- 3. Add trial tracking
ALTER TABLE public.brands
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP WITH TIME ZONE;

-- 4. Ensure foreign key performance
CREATE INDEX IF NOT EXISTS idx_brands_owner_id ON public.brands(owner_id);
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON public.products(brand_id);

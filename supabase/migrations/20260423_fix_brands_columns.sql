-- Migration: Add missing columns to brands
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS fee_paid BOOLEAN DEFAULT FALSE;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;

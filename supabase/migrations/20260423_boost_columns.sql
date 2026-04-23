-- Migration: Add boost tracking to brands
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS boost_level TEXT;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS boost_expires_at TIMESTAMP WITH TIME ZONE;

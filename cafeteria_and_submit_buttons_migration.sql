-- Migration: Cafeterias and Submit Buttons Schema
-- Run this in the Supabase SQL editor to create the necessary tables and columns

-- 1. Create cafeterias table
CREATE TABLE IF NOT EXISTS public.cafeterias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.cafeterias ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "uni admins manage cafeterias" ON public.cafeterias;
DROP POLICY IF EXISTS "anyone can read cafeterias" ON public.cafeterias;

-- Create RLS Policies
CREATE POLICY "uni admins manage cafeterias" ON public.cafeterias
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND university_id = cafeterias.university_id
      AND role IN ('university_admin', 'admin')
    )
  );

CREATE POLICY "anyone can read cafeterias" ON public.cafeterias
  FOR SELECT USING (TRUE);

-- 2. Add cafeteria_ids UUID array to products table if it doesn't exist
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cafeteria_ids UUID[] DEFAULT '{}';

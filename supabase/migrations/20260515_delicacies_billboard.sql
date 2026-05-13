-- MasterCart Delicacies Premium Billboard System

-- 1. Create the delicacies_billboards table
CREATE TABLE IF NOT EXISTS public.delicacies_billboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE, -- Optional, if they promote a specific product
    university_id UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    active BOOLEAN DEFAULT true
);

-- Enable RLS
ALTER TABLE public.delicacies_billboards ENABLE ROW LEVEL SECURITY;

-- Policies for delicacies_billboards
CREATE POLICY "Public can view active delicacies billboards"
ON public.delicacies_billboards
FOR SELECT
USING (active = true AND expires_at > NOW());

CREATE POLICY "Brands can view their own billboards"
ON public.delicacies_billboards
FOR SELECT
USING (auth.uid() IN (SELECT owner_id FROM public.brands WHERE id = brand_id));

CREATE POLICY "Brands can insert their own billboards"
ON public.delicacies_billboards
FOR INSERT
WITH CHECK (auth.uid() IN (SELECT owner_id FROM public.brands WHERE id = brand_id));

-- Admin can manage all
CREATE POLICY "Super admins can manage delicacies billboards"
ON public.delicacies_billboards
FOR ALL
USING (auth.uid() IN (SELECT id FROM public.users WHERE role = 'admin'));

-- 2. Setup the global pricing default (500 NGN per day)
-- This assumes platform_settings already exists. We will upsert the config.
INSERT INTO public.platform_settings (key, value, description)
VALUES (
  'delicacies_billboard_price', 
  '{"price_per_day": 500}', 
  'Base price per day in NGN for a delicacy vendor to buy a billboard slot.'
)
ON CONFLICT (key) DO UPDATE 
SET value = '{"price_per_day": 500}';

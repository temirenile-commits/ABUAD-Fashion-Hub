-- UNIVERSITY ISOLATION & DATA REPAIR SCRIPT
-- This script ensures all existing data is assigned to ABUAD and isolated from other universities.

-- 1. IDENTIFY ABUAD ID
-- ABUAD ID is '00000000-0000-0000-0000-000000000001' based on multi_university_migration.sql

-- 2. ASSIGN ALL UNASSIGNED USERS TO ABUAD
UPDATE public.users 
SET university_id = '00000000-0000-0000-0000-000000000001'
WHERE university_id IS NULL;

-- 3. ASSIGN ALL UNASSIGNED BRANDS TO ABUAD
UPDATE public.brands 
SET university_id = '00000000-0000-0000-0000-000000000001'
WHERE university_id IS NULL;

-- 4. ASSIGN ALL UNASSIGNED PRODUCTS TO ABUAD
-- Also set visibility to 'university' so they don't leak to other campuses as 'global'
UPDATE public.products 
SET 
  university_id = '00000000-0000-0000-0000-000000000001',
  visibility_type = 'university'
WHERE university_id IS NULL OR visibility_type = 'global';

-- 5. ASSIGN ALL REELS TO ABUAD
-- We might need a university_id column on brand_reels if it's missing
ALTER TABLE public.brand_reels ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES public.universities(id);

UPDATE public.brand_reels br
SET university_id = b.university_id
FROM public.brands b
WHERE br.brand_id = b.id AND br.university_id IS NULL;

UPDATE public.brand_reels
SET university_id = '00000000-0000-0000-0000-000000000001'
WHERE university_id IS NULL;

-- 6. ASSIGN ALL ORDERS AND DELIVERIES
UPDATE public.orders SET university_id = '00000000-0000-0000-0000-000000000001' WHERE university_id IS NULL;
UPDATE public.deliveries SET university_id = '00000000-0000-0000-0000-000000000001' WHERE university_id IS NULL;
UPDATE public.delivery_agents SET university_id = '00000000-0000-0000-0000-000000000001' WHERE university_id IS NULL;

-- 7. REFRESH SCHEMA CACHE
NOTIFY pgrst, 'reload schema';

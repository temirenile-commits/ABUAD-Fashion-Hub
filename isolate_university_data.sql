-- UNIVERSITY ISOLATION & DATA REPAIR SCRIPT (V2 - Corrected Logic)
-- 1. IDENTIFY ABUAD ID
-- ABUAD ID is '00000000-0000-0000-0000-000000000001'

-- 2. PRODUCTS & BRANDS (Current Data Clean-up)
-- All existing products and brands were uploaded by ABUAD vendors.
-- We classify them as ABUAD-specific.

UPDATE public.brands 
SET university_id = '00000000-0000-0000-0000-000000000001'
WHERE university_id IS NULL;

UPDATE public.products 
SET 
  university_id = '00000000-0000-0000-0000-000000000001',
  visibility_type = 'university'
WHERE university_id IS NULL;

-- 3. REELS (Current Data Clean-up)
UPDATE public.brand_reels
SET university_id = '00000000-0000-0000-0000-000000000001'
WHERE university_id IS NULL;

-- 4. USERS (General Students/Users)
-- Do NOT assign unassigned users to ABUAD.
-- Keep them as NULL (General).
-- (No action needed as they are already NULL if not assigned)

-- 5. ENSURE VISIBILITY TYPE FOR GLOBAL PRODUCTS
-- Any product WITHOUT a university_id should be 'global'
UPDATE public.products 
SET visibility_type = 'global'
WHERE university_id IS NULL;

-- 6. OPERATIONAL DATA (Orders, Payouts)
-- Since all existing products are ABUAD, existing orders/payouts are also ABUAD.
UPDATE public.orders SET university_id = '00000000-0000-0000-0000-000000000001' WHERE university_id IS NULL;
UPDATE public.payout_requests SET university_id = '00000000-0000-0000-0000-000000000001' WHERE university_id IS NULL;

-- 7. REFRESH SCHEMA CACHE
NOTIFY pgrst, 'reload schema';

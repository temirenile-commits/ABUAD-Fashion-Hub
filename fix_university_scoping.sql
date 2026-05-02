-- SCOPING REPAIR SCRIPT
-- Run this in Supabase SQL Editor to fix data gaps and enable university admin verification

-- 1. Ensure all university admins/staff have a university_id (Default to ABUAD if missing)
UPDATE public.users 
SET university_id = '00000000-0000-0000-0000-000000000001'
WHERE role IN ('university_admin', 'university_staff', 'customer_support_agent') 
  AND university_id IS NULL;

-- 2. Propagate university_id to BRANDS from their owner
UPDATE public.brands b
SET university_id = u.university_id
FROM public.users u
WHERE b.owner_id = u.id AND b.university_id IS NULL;

-- 3. Propagate university_id to DELIVERY AGENTS from their user profile
UPDATE public.delivery_agents da
SET university_id = u.university_id
FROM public.users u
WHERE da.id = u.id AND da.university_id IS NULL;

-- 4. Propagate university_id to PRODUCTS from their brand
UPDATE public.products p
SET university_id = b.university_id
FROM public.brands b
WHERE p.brand_id = b.id AND p.university_id IS NULL;

-- 5. Propagate university_id to ORDERS (from customer's university)
UPDATE public.orders o
SET university_id = u.university_id
FROM public.users u
WHERE o.customer_id = u.id AND o.university_id IS NULL;

-- 6. Ensure all notifications and reviews are scoped
UPDATE public.notifications n SET university_id = u.university_id FROM public.users u WHERE n.user_id = u.id AND n.university_id IS NULL;
UPDATE public.reviews r SET university_id = u.university_id FROM public.users u WHERE r.user_id = u.id AND r.university_id IS NULL;

-- 7. Add Check Constraint to prevent NULL university_id for scoped data
-- (Optional: uncomment if you want to enforce this at the DB level)
-- ALTER TABLE public.users ALTER COLUMN university_id SET NOT NULL;
-- ALTER TABLE public.brands ALTER COLUMN university_id SET NOT NULL;

-- 8. Refresh Schema Cache
NOTIFY pgrst, 'reload schema';

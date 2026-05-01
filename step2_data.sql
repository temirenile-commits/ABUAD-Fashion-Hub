-- ============================================================
-- STEP 2: DATA BACKFILL AND POLICIES
-- Run this AFTER step1_schema.sql
-- ============================================================

DO $$
BEGIN
  -- 1. Users
  EXECUTE 'UPDATE public.users SET university_id = ''00000000-0000-0000-0000-000000000001'' WHERE university_id IS NULL';
  
  -- 2. Brands
  EXECUTE 'UPDATE public.brands SET university_id = ''00000000-0000-0000-0000-000000000001'' WHERE university_id IS NULL';
  
  -- 3. Products
  EXECUTE 'UPDATE public.products SET university_id = ''00000000-0000-0000-0000-000000000001'', visibility_type = ''university'' WHERE university_id IS NULL';
  
  -- 4. Orders
  EXECUTE 'UPDATE public.orders o SET university_id = u.university_id FROM public.users u WHERE o.customer_id = u.id AND o.university_id IS NULL';
  EXECUTE 'UPDATE public.orders SET university_id = ''00000000-0000-0000-0000-000000000001'' WHERE university_id IS NULL';
  
  -- 5. Deliveries
  EXECUTE 'UPDATE public.deliveries d SET university_id = o.university_id FROM public.orders o WHERE d.order_id = o.id AND d.university_id IS NULL';
  EXECUTE 'UPDATE public.deliveries SET university_id = ''00000000-0000-0000-0000-000000000001'' WHERE university_id IS NULL';
  
  -- 6. Delivery Agents
  EXECUTE 'UPDATE public.delivery_agents da SET university_id = u.university_id FROM public.users u WHERE da.id = u.id AND da.university_id IS NULL';
  
  -- 7. Reviews
  EXECUTE 'UPDATE public.reviews r SET university_id = u.university_id FROM public.users u WHERE r.user_id = u.id AND r.university_id IS NULL';
END $$;

-- Search Indexes
CREATE INDEX IF NOT EXISTS idx_users_university_id ON public.users(university_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_brands_university_id ON public.brands(university_id);
CREATE INDEX IF NOT EXISTS idx_brands_verification_status ON public.brands(verification_status);
CREATE INDEX IF NOT EXISTS idx_products_university_id ON public.products(university_id);
CREATE INDEX IF NOT EXISTS idx_products_visibility_type ON public.products(visibility_type);
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON public.products(brand_id);
CREATE INDEX IF NOT EXISTS idx_orders_university_id ON public.orders(university_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_university_id ON public.deliveries(university_id);
CREATE INDEX IF NOT EXISTS idx_delivery_agents_university_id ON public.delivery_agents(university_id);
CREATE INDEX IF NOT EXISTS idx_reviews_university_id ON public.reviews(university_id);

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES public.universities(id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_university_id ON public.notifications(university_id);

-- ─── 14. UPDATED RLS POLICIES — PRODUCTS ────────────────────
DROP POLICY IF EXISTS "Products are viewable by everyone." ON public.products;

CREATE POLICY "Marketplace product visibility" ON public.products FOR SELECT
USING (
  visibility_type = 'global'
  OR (
    university_id IS NOT NULL
    AND university_id = (
      SELECT university_id FROM public.users WHERE id = auth.uid()
    )
  )
  OR auth.uid() IS NULL 
);

CREATE POLICY "Vendors see own products" ON public.products FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.brands 
    WHERE brands.id = products.brand_id AND brands.owner_id = auth.uid()
  )
);

-- ─── 15. UPDATED RLS — ORDERS ────────────────────────────────
DROP POLICY IF EXISTS "Customers view own orders." ON public.orders;
DROP POLICY IF EXISTS "Vendors view own orders." ON public.orders;

CREATE POLICY "Customers view own orders." ON public.orders FOR SELECT 
USING (auth.uid() = customer_id);

CREATE POLICY "Vendors view own orders." ON public.orders FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.brands WHERE id = brand_id AND owner_id = auth.uid()
  )
);

CREATE POLICY "University staff view scoped orders." ON public.orders FOR SELECT
USING (
  university_id = (
    SELECT university_id FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('university_admin', 'university_staff')
  )
);

-- ─── 16. CROSS-UNIVERSITY ANALYTICS VIEW (READ-ONLY) ────────
CREATE OR REPLACE VIEW public.university_analytics AS
SELECT
  u.id AS university_id,
  u.name AS university_name,
  u.abbreviation,
  COUNT(DISTINCT us.id) AS total_users,
  COUNT(DISTINCT b.id) AS total_vendors,
  COUNT(DISTINCT b.id) FILTER (WHERE b.verification_status = 'verified') AS verified_vendors,
  COUNT(DISTINCT p.id) AS total_products,
  COUNT(DISTINCT o.id) AS total_orders,
  COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'paid') AS paid_orders,
  COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'paid'), 0) AS total_revenue
FROM public.universities u
LEFT JOIN public.users us ON us.university_id = u.id
LEFT JOIN public.brands b ON b.university_id = u.id
LEFT JOIN public.products p ON p.university_id = u.id
LEFT JOIN public.orders o ON o.university_id = u.id
GROUP BY u.id, u.name, u.abbreviation;

GRANT SELECT ON public.university_analytics TO authenticated;

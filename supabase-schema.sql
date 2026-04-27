-- ABUAD Fashion Hub Schema (Phase 3 Upgrade)
-- Run this in your Supabase SQL Editor

-- 1. Users Table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('customer', 'vendor', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public users are viewable by everyone." ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON public.users FOR UPDATE USING (auth.uid() = id);

-- 2. Brands Table (Enhanced)
CREATE TABLE IF NOT EXISTS public.brands (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES public.users(id) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  whatsapp_number TEXT,
  instagram_link TEXT,
  
  -- Academic Verification Module
  room_number TEXT,
  matric_number TEXT,
  college TEXT,
  department TEXT,
  
  -- Verification Module
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected', 'suspended')),
  verified BOOLEAN DEFAULT FALSE,
  fee_paid BOOLEAN DEFAULT FALSE,
  student_id_url TEXT,
  business_proof_url TEXT,
  
  -- Phase 3 Monitization & Limits
  delivery_preference TEXT DEFAULT 'platform' CHECK (delivery_preference IN ('platform', 'vendor')),
  subscription_tier TEXT DEFAULT 'free',
  max_products INTEGER DEFAULT 0,
  max_reels INTEGER DEFAULT 0,
  subscription_expires_at TIMESTAMP WITH TIME ZONE,
  trial_started_at TIMESTAMP WITH TIME ZONE,

  wallet_balance DECIMAL DEFAULT 0.00,
  visibility_score INTEGER DEFAULT 100,
   bank_account_number TEXT,
   bank_account_name TEXT,
   bank_name TEXT,
   bank_code TEXT,
   terms_accepted BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Brands are viewable by everyone." ON public.brands FOR SELECT USING (true);
CREATE POLICY "Vendors can insert their own brand." ON public.brands FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Vendors can update their own brand." ON public.brands FOR UPDATE USING (auth.uid() = owner_id);

-- 3. Products Table (Enhanced)
CREATE TABLE IF NOT EXISTS public.products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID REFERENCES public.brands(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  price DECIMAL NOT NULL,
  original_price DECIMAL,
  category TEXT NOT NULL,
  media_urls TEXT[] DEFAULT '{}',
  video_url TEXT,
  stock_count INTEGER DEFAULT -1, -- -1 for unlimited
  is_featured BOOLEAN DEFAULT FALSE,
  boost_level INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  sales_count INTEGER DEFAULT 0,
  locked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Products are viewable by everyone." ON public.products FOR SELECT USING (true);
CREATE POLICY "Vendors can manage their products." ON public.products FOR ALL USING (EXISTS (SELECT 1 FROM public.brands WHERE id = brand_id AND owner_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.brands WHERE id = brand_id AND owner_id = auth.uid()));

-- 4. Services Table
CREATE TABLE IF NOT EXISTS public.services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID REFERENCES public.brands(id) NOT NULL,
  service_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  price DECIMAL NOT NULL,
  portfolio_urls TEXT[] DEFAULT '{}',
  is_featured BOOLEAN DEFAULT FALSE,
  locked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Services are viewable by everyone." ON public.services FOR SELECT USING (true);
CREATE POLICY "Vendors can manage their services." ON public.services FOR ALL USING (EXISTS (SELECT 1 FROM public.brands WHERE id = brand_id AND owner_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.brands WHERE id = brand_id AND owner_id = auth.uid()));

-- 5. Orders Table (Escrow Core)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES public.users(id) NOT NULL,
  brand_id UUID REFERENCES public.brands(id) NOT NULL,
  product_id UUID REFERENCES public.products(id),
  service_id UUID REFERENCES public.services(id),
  total_amount DECIMAL NOT NULL,
  commission_amount DECIMAL NOT NULL, -- 7.5% or 10% calculated at creation
  vendor_earning DECIMAL NOT NULL,
  
  -- Status flow: pending -> paid (escrow) -> ready -> picked_up -> in_transit -> delivered -> confirmed
  status TEXT DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'paid', 'ready', 'picked_up', 'in_transit', 'delivered', 'confirmed', 'completed', 'cancelled', 'refunded')),
  delivery_method TEXT NOT NULL CHECK (delivery_method IN ('platform', 'vendor')),
  
  paystack_reference TEXT,
  shipping_address TEXT,
  customer_phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  confirmed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers view own orders." ON public.orders FOR SELECT USING (auth.uid() = customer_id);
CREATE POLICY "Vendors view own orders." ON public.orders FOR SELECT USING (EXISTS (SELECT 1 FROM public.brands WHERE id = brand_id AND owner_id = auth.uid()));

-- 6. Transactions (Ledger)
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id),
  brand_id UUID REFERENCES public.brands(id),
  user_id UUID REFERENCES public.users(id),
  type TEXT NOT NULL CHECK (type IN ('payment_in', 'escrow_release', 'payout', 'refund')),
  amount DECIMAL NOT NULL,
  status TEXT DEFAULT 'success',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own transactions." ON public.transactions FOR SELECT USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.brands WHERE id = brand_id AND owner_id = auth.uid()));

-- 7. Deliveries Table
CREATE TABLE IF NOT EXISTS public.deliveries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) NOT NULL UNIQUE,
  rider_name TEXT,
  rider_phone TEXT,
  pickup_code TEXT,
  delivery_code TEXT,
  tracking_updates JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can track deliveries." ON public.deliveries FOR SELECT USING (true); -- simplified for now, can be restricted later

-- 8. Messages System
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES public.users(id) NOT NULL,
  receiver_id UUID REFERENCES public.users(id) NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view their messages." ON public.messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send messages." ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- 9. Brand Reels (Short Video Posters)
CREATE TABLE IF NOT EXISTS public.brand_reels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID REFERENCES public.brands(id) NOT NULL,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  title TEXT,
  file_size_mb DECIMAL,
  is_paid BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.brand_reels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Brand reels are public." ON public.brand_reels FOR SELECT USING (true);
CREATE POLICY "Vendors manage own reels." ON public.brand_reels FOR ALL USING (EXISTS (SELECT 1 FROM public.brands WHERE id = brand_id AND owner_id = auth.uid()));

-- 10. Storage Policies (Ensure videos are playable)
INSERT INTO storage.buckets (id, name, public) VALUES ('product-media', 'product-media', true), ('brand-reels', 'brand-reels', true) ON CONFLICT (id) DO UPDATE SET public = true;
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id IN ('product-media', 'brand-reels', 'product-images', 'brand-logos') );

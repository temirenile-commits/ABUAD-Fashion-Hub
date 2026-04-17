-- ABUAD Fashion Hub Schema
-- Run this in your Supabase SQL Editor

-- 1. Users Table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer', 'vendor', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Turn on RLS for users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public users are viewable by everyone."
  ON public.users FOR SELECT
  USING ( true );

CREATE POLICY "Users can insert their own profile."
  ON public.users FOR INSERT
  WITH CHECK ( auth.uid() = id );

CREATE POLICY "Users can update own profile."
  ON public.users FOR UPDATE
  USING ( auth.uid() = id );

-- 2. Brands Table
CREATE TABLE IF NOT EXISTS public.brands (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES public.users(id) NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  whatsapp_number TEXT,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brands are viewable by everyone."
  ON public.brands FOR SELECT
  USING ( true );

CREATE POLICY "Vendors can insert their own brand."
  ON public.brands FOR INSERT
  WITH CHECK ( auth.uid() = owner_id );

CREATE POLICY "Vendors can update their own brand."
  ON public.brands FOR UPDATE
  USING ( auth.uid() = owner_id );

-- 3. Products Table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID REFERENCES public.brands(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  price DECIMAL NOT NULL,
  category TEXT NOT NULL,
  media_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Products are viewable by everyone."
  ON public.products FOR SELECT
  USING ( true );

CREATE POLICY "Vendors can insert products for their brand."
  ON public.products FOR INSERT
  WITH CHECK ( 
    EXISTS (
      SELECT 1 FROM public.brands WHERE id = brand_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Vendors can update their products."
  ON public.products FOR UPDATE
  USING ( 
    EXISTS (
      SELECT 1 FROM public.brands WHERE id = brand_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Vendors can delete their products."
  ON public.products FOR DELETE
  USING ( 
    EXISTS (
      SELECT 1 FROM public.brands WHERE id = brand_id AND owner_id = auth.uid()
    )
  );

-- 4. Services Table
CREATE TABLE IF NOT EXISTS public.services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID REFERENCES public.brands(id) NOT NULL,
  service_type TEXT NOT NULL,
  description TEXT,
  pricing_details TEXT,
  portfolio_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Services are viewable by everyone."
  ON public.services FOR SELECT
  USING ( true );

CREATE POLICY "Vendors can insert and manage their services."
  ON public.services ALL
  USING ( 
    EXISTS (
      SELECT 1 FROM public.brands WHERE id = brand_id AND owner_id = auth.uid()
    )
  );

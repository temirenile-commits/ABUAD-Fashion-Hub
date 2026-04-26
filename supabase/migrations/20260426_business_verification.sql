-- Migration: Business Verification & Bank Details (2026-04-26)

ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS verification_type TEXT DEFAULT 'academic' CHECK (verification_type IN ('academic', 'business'));
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS business_name TEXT;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS business_registration_number TEXT;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS business_address TEXT;

ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS bank_account_number TEXT;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS bank_account_name TEXT;

-- Notify schema reload
NOTIFY pgrst, 'reload schema';

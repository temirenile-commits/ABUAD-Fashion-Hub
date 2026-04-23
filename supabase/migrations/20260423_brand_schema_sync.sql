-- CATCH-UP MIGRATION: Ensure all modern Brand columns exist
DO $$ 
BEGIN 
    -- Academic Module
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS room_number TEXT;
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS matric_number TEXT;
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS college TEXT;
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS department TEXT;
    
    -- Verification Module
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS fee_paid BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS student_id_url TEXT;
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS business_proof_url TEXT;
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT FALSE;

    -- Subscription & Visibility Module
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS max_products INTEGER DEFAULT 0;
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS max_reels INTEGER DEFAULT 0;
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS boost_level TEXT;
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS boost_expires_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS visibility_score INTEGER DEFAULT 100;

    -- Financial Module
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS wallet_balance DECIMAL DEFAULT 0.00;
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS bank_account_number TEXT;
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS bank_name TEXT;
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS bank_code TEXT;

    -- Settings
    ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS delivery_preference TEXT DEFAULT 'platform';

END $$;

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';

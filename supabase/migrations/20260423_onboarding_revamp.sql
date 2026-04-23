-- Migration: New simplified verification & Credit system
-- Room 101, Matric 123, College of Engineering, Dept of EEE

ALTER TABLE public.brands 
ADD COLUMN IF NOT EXISTS room_number TEXT,
ADD COLUMN IF NOT EXISTS matric_number TEXT,
ADD COLUMN IF NOT EXISTS college TEXT,
ADD COLUMN IF NOT EXISTS department TEXT,
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Update existing brands to have 5 credits if they haven't used them
UPDATE public.brands SET free_listings_count = 5 WHERE free_listings_count IS NULL;

-- Remove the fee requirement column logic if necessary (or just ignore it in code)
-- We keep fee_paid for backward compat but won't check it in new flow.

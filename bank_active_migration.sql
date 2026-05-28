-- ====================================================
-- MIGRATION: Bank Account Active Toggle
-- Run this in your Supabase SQL Editor
-- Adds `is_active` column to university_bank_accounts
-- The `is_active` flag replaces `is_primary` as the
-- mechanism for selecting which account to show at checkout.
-- Only ONE account can be active at a time per university.
-- ====================================================

-- 1. Add is_active column (defaults TRUE so existing accounts remain visible)
ALTER TABLE public.university_bank_accounts
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE;

-- 2. Carry over: whichever account was primary → set as active
UPDATE public.university_bank_accounts
  SET is_active = TRUE
  WHERE is_primary = TRUE;

-- 3. Ensure at most one active per university (keep only the is_primary one)
--    This is enforced at the application layer (toggle_bank_active deactivates others first).

-- 4. Add platform_settings key support for per-university superadmin default bank
--    (No schema change needed — it uses the existing platform_settings JSON store)
--    Key pattern: uni_default_bank_<university_uuid>
--    Value: { bank_name, account_number, account_name, bank_code }

-- Done. You can now use toggle_bank_active in the university admin panel.

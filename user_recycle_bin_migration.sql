-- ============================================================
-- User Recycle Bin Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Update status check constraint to support 'deleted' status
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE public.users ADD CONSTRAINT users_status_check CHECK (status IN ('active', 'suspended', 'blocked', 'deleted'));

-- 2. Add soft-delete columns to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by_super_admin BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_reason TEXT DEFAULT NULL;

-- 2. Mark any currently 'blocked' users that were "accidentally deleted"
--    by the old delete_user flow (which set status='blocked' as fallback).
--    We distinguish them by checking if they have no active orders as vendor
--    and were blocked without a specific reason. 
--    NOTE: Run ONLY if you want to migrate existing blocked users to 'deleted'.
--    Comment out this block if you want to keep blocked users separate.

-- UPDATE public.users 
-- SET status = 'deleted', deleted_at = created_at
-- WHERE status = 'blocked' 
--   AND deleted_at IS NULL;

-- 3. Index for fast recycle bin queries
CREATE INDEX IF NOT EXISTS idx_users_status_deleted 
  ON public.users(status) 
  WHERE status = 'deleted';

CREATE INDEX IF NOT EXISTS idx_users_deleted_at 
  ON public.users(deleted_at) 
  WHERE deleted_at IS NOT NULL;

-- 4. Notify schema cache to reload
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- VERIFY: Check columns were added
-- ============================================================
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'users' 
--   AND column_name IN ('deleted_at', 'deleted_by_super_admin', 'deleted_reason');

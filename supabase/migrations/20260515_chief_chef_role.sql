-- Introduce Chief Chef terminology and dashboard switching state
ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS active_dashboard_mode TEXT NOT NULL DEFAULT 'normal'
    CHECK (active_dashboard_mode IN ('normal', 'chief_chef'));

-- Add a comment to explain the marketplace_type connection
COMMENT ON COLUMN brands.marketplace_type IS 'fashion = normal, delicacies = chief_chef, both = can switch';

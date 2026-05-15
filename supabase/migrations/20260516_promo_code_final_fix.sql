-- Add missing columns to promo_codes table
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id) ON DELETE CASCADE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_promo_codes_product_id ON promo_codes(product_id);
CREATE INDEX IF NOT EXISTS idx_promo_codes_brand_id ON promo_codes(brand_id);

-- Ensure other advanced columns from previous migrations are present (just in case they failed earlier)
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES universities(id) ON DELETE CASCADE;
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS target_customer_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS min_account_age_days INTEGER DEFAULT 0;
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS min_purchase_amount NUMERIC DEFAULT 0;
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS is_regular_patrons_only BOOLEAN DEFAULT FALSE;
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS funding_reference TEXT;
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS is_funded BOOLEAN DEFAULT TRUE;

-- Enable Realtime for promo_codes if not already enabled
-- Check if it exists in publication first (usually handled by Supabase Dashboard, but helpful to have here)
-- ALTER PUBLICATION supabase_realtime ADD TABLE promo_codes; 

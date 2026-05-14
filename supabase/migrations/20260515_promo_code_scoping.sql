-- Add university_id to promo_codes table
ALTER TABLE promo_codes ADD COLUMN university_id UUID REFERENCES universities(id) ON DELETE CASCADE;

-- Update existing promo codes to be global (university_id IS NULL)
-- No changes needed as they will default to NULL.

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_promo_codes_university_id ON promo_codes(university_id);

-- 1. Fix Product Upload (Preorder fields)
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_preorder BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS preorder_arrival_date TIMESTAMP WITH TIME ZONE;

-- 2. Delicacy Categories
CREATE TABLE IF NOT EXISTS delicacy_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    commission_rate NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pre-seed some default categories
INSERT INTO delicacy_categories (name, commission_rate) VALUES
('Pastries', 0), 
('Drinks', 0), 
('Meals', 0), 
('Snacks', 0), 
('Desserts', 0), 
('Healthy & Salads', 0)
ON CONFLICT (name) DO NOTHING;

-- 3. Promo Codes Enhancements
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS target_customer_id UUID REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS min_account_age_days INTEGER;
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS min_purchase_amount NUMERIC;
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS is_regular_patrons_only BOOLEAN DEFAULT FALSE;
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS funding_reference TEXT;
ALTER TABLE promo_codes ADD COLUMN IF NOT EXISTS is_funded BOOLEAN DEFAULT TRUE;


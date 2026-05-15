-- 1. Create separate storage buckets for Delicacies
INSERT INTO storage.buckets (id, name, public) 
VALUES ('delicacies-media', 'delicacies-media', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('delicacies-videos', 'delicacies-videos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Setup public access policies for new buckets
CREATE POLICY "Public Access for Delicacies Media"
ON storage.objects FOR SELECT
USING ( bucket_id = 'delicacies-media' );

CREATE POLICY "Vendor Upload for Delicacies Media"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'delicacies-media' AND auth.role() = 'authenticated' );

CREATE POLICY "Public Access for Delicacies Videos"
ON storage.objects FOR SELECT
USING ( bucket_id = 'delicacies-videos' );

CREATE POLICY "Vendor Upload for Delicacies Videos"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'delicacies-videos' AND auth.role() = 'authenticated' );

-- 3. Add index for faster product_section filtering
CREATE INDEX IF NOT EXISTS idx_products_section ON products(product_section);
CREATE INDEX IF NOT EXISTS idx_products_section_draft ON products(product_section, is_draft);

-- 4. Clean up any existing miscategorized delicacies (optional safety)
-- UPDATE products SET product_section = 'delicacies' WHERE category IN ('snacks', 'small_chops', 'pastries', 'main_dish', 'sides', 'beverages', 'provisions');

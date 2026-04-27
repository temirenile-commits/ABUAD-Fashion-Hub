-- RUN THIS IN YOUR SUPABASE SQL EDITOR TO CREATE VIDEO-SPECIFIC BUCKETS

-- 1. Create product-videos bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-videos', 'product-videos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Create brand-reels bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('brand-reels', 'brand-reels', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Allow public access to product-videos
CREATE POLICY "Public Access for product-videos" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'product-videos');

-- 4. Allow authenticated users to upload to product-videos
CREATE POLICY "Auth Upload for product-videos" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'product-videos' AND auth.role() = 'authenticated');

-- 5. Allow public access to brand-reels
CREATE POLICY "Public Access for brand-reels" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'brand-reels');

-- 6. Allow authenticated users to upload to brand-reels
CREATE POLICY "Auth Upload for brand-reels" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'brand-reels' AND auth.role() = 'authenticated');

-- 7. Add expiration to orders for 30-min window
ALTER TABLE orders ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

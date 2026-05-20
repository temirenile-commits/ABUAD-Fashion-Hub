-- 1. Relax storage insert policies to allow any authenticated user (including normal customers) to upload their avatars to the 'brand-assets' bucket
DROP POLICY IF EXISTS "Admin/Vendor Upload Assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload brand assets" ON storage.objects;

CREATE POLICY "Allow authenticated users to upload assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'brand-assets');

-- 2. Ensure public read access is enabled for the 'brand-assets' bucket
DROP POLICY IF EXISTS "Public Access Assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow public select on brand assets" ON storage.objects;

CREATE POLICY "Allow public select on brand assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'brand-assets');

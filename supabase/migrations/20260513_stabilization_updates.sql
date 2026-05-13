-- Stabilization Updates (2026-05-13)

-- 1. Update Homepage Sections Table
ALTER TABLE homepage_sections ADD COLUMN IF NOT EXISTS link_url TEXT;

-- 2. Create Storage Buckets for Assets
-- Note: SQL cannot create buckets directly in some environments, but we can attempt to insert into storage.buckets
-- or leave this as a reminder for the admin.

INSERT INTO storage.buckets (id, name, public) 
VALUES ('brand-assets', 'brand-assets', true), ('homepage-sections', 'homepage-sections', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. Set Storage Policies
CREATE POLICY "Public Access Assets" ON storage.objects FOR SELECT USING ( bucket_id IN ('brand-assets', 'homepage-sections') );
CREATE POLICY "Admin/Vendor Upload Assets" ON storage.objects FOR INSERT WITH CHECK ( bucket_id IN ('brand-assets', 'homepage-sections') );

-- 4. Ensure University Config Structure
-- No table changes needed, logic handled in platform_settings JSON.

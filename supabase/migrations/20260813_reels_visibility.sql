-- ABUAD Fashion Hub: Reels Visibility and Audience Targeting
-- Adds visibility_type and university_id to the authoritative reels table

ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS visibility_type text DEFAULT 'university';
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS university_id uuid REFERENCES public.universities(id);

-- Update RLS for visibility logic
DROP POLICY IF EXISTS "Reels are viewable by everyone" ON public.reels;

CREATE POLICY "Reels are viewable based on visibility settings" ON public.reels
FOR SELECT USING (
  status = 'published' AND (
    visibility_type = 'all' OR 
    visibility_type = 'public' OR
    (visibility_type = 'university' AND (
      university_id IS NULL OR 
      university_id IN (SELECT university_id FROM public.users WHERE id = auth.uid())
    ))
  )
);

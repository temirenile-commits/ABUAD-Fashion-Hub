-- ABUAD Fashion Hub: Add cover_url to reels table for video thumbnails
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS cover_url text;

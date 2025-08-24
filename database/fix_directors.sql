-- Fix directors field mismatch in existing database
-- Run this in your Supabase SQL editor

-- First, check what columns currently exist
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'films' 
ORDER BY ordinal_position;

-- Add directors column if it doesn't exist
ALTER TABLE films ADD COLUMN IF NOT EXISTS directors TEXT[];

-- Update existing films to have directors data (if director column exists)
-- This will copy data from the old 'director' column to the new 'directors' array
UPDATE films 
SET directors = ARRAY[director] 
WHERE director IS NOT NULL AND directors IS NULL;

-- Drop the old director column if it exists and we've migrated the data
ALTER TABLE films DROP COLUMN IF EXISTS director;

-- Recreate the view to use the correct field names
DROP VIEW IF EXISTS user_films_with_films;

CREATE OR REPLACE VIEW user_films_with_films AS
SELECT 
    uf.user_handle,
    uf.film_slug,
    uf.rating,
    uf.liked,
    f.film_title,
    f.year,
    f.directors,
    f.genres,
    f.popularity,
    f.poster_url
FROM user_films uf
JOIN films f ON uf.film_slug = f.film_slug;

-- Verify the fix
SELECT 
    film_slug,
    directors,
    genres,
    popularity
FROM films 
LIMIT 5;

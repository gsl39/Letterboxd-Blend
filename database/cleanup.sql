-- Cleanup script to remove unnecessary updated_at columns and triggers
-- Run this in your Supabase SQL editor to clean up the database

-- Drop triggers first
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_films_updated_at ON films;
DROP TRIGGER IF EXISTS update_user_films_updated_at ON user_films;
DROP TRIGGER IF EXISTS update_blends_updated_at ON blends;

-- Drop the function
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Remove updated_at columns if they exist
ALTER TABLE users DROP COLUMN IF EXISTS updated_at;
ALTER TABLE films DROP COLUMN IF EXISTS updated_at;
ALTER TABLE user_films DROP COLUMN IF EXISTS updated_at;
ALTER TABLE blends DROP COLUMN IF EXISTS updated_at;

-- Recreate the view to ensure it's clean
DROP VIEW IF EXISTS user_films_with_films;

CREATE OR REPLACE VIEW user_films_with_films AS
SELECT 
    uf.user_handle,
    uf.film_slug,
    uf.rating,
    uf.liked,
    f.film_title,
    f.year,
    f.director,
    f.genres,
    f.popularity,
    f.poster_url
FROM user_films uf
JOIN films f ON uf.film_slug = f.film_slug;

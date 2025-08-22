-- 🎬 Letterboxd Blend Database Setup
-- Run this script in your Supabase SQL editor

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    user_handle VARCHAR(255) PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create films table
CREATE TABLE IF NOT EXISTS films (
    film_slug VARCHAR(255) PRIMARY KEY,
    film_title VARCHAR(500) NOT NULL,
    year INTEGER,
    director VARCHAR(255),
    genres TEXT[], -- Array of genre strings
    popularity INTEGER,
    poster_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_films table (junction table)
CREATE TABLE IF NOT EXISTS user_films (
    id SERIAL PRIMARY KEY,
    user_handle VARCHAR(255) REFERENCES users(user_handle) ON DELETE CASCADE,
    film_slug VARCHAR(255) REFERENCES films(film_slug) ON DELETE CASCADE,
    rating DECIMAL(2,1) CHECK (rating >= 0 AND rating <= 5), -- 0.0 to 5.0
    liked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_handle, film_slug)
);

-- Create blends table
CREATE TABLE IF NOT EXISTS blends (
    blend_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_a VARCHAR(255) REFERENCES users(user_handle) ON DELETE CASCADE,
    user_b VARCHAR(255) REFERENCES users(user_handle) ON DELETE CASCADE,
    total_score DECIMAL(5,2),
    genre_alignment DECIMAL(5,2),
    director_alignment DECIMAL(5,2),
    rating_alignment DECIMAL(5,2),
    obscurity_alignment DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_a, user_b)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_films_user_handle ON user_films(user_handle);
CREATE INDEX IF NOT EXISTS idx_user_films_film_slug ON user_films(film_slug);
CREATE INDEX IF NOT EXISTS idx_user_films_rating ON user_films(rating);
CREATE INDEX IF NOT EXISTS idx_films_popularity ON films(popularity);
CREATE INDEX IF NOT EXISTS idx_blends_users ON blends(user_a, user_b);

-- Create a view for user films with film metadata
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

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE films ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_films ENABLE ROW LEVEL SECURITY;
ALTER TABLE blends ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your security needs)
-- For now, allowing all operations - you may want to restrict this
CREATE POLICY "Allow all operations on users" ON users FOR ALL USING (true);
CREATE POLICY "Allow all operations on films" ON films FOR ALL USING (true);
CREATE POLICY "Allow all operations on user_films" ON user_films FOR ALL USING (true);
CREATE POLICY "Allow all operations on blends" ON blends FOR ALL USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_films_updated_at BEFORE UPDATE ON films
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_films_updated_at BEFORE UPDATE ON user_films
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blends_updated_at BEFORE UPDATE ON blends
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data (optional)
-- INSERT INTO users (user_handle) VALUES ('example_user');
-- INSERT INTO films (film_slug, film_title, year, director) VALUES ('example-film', 'Example Film', 2024, 'Example Director');

-- Grant necessary permissions (adjust based on your setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO authenticated;

COMMENT ON TABLE users IS 'Letterboxd user accounts';
COMMENT ON TABLE films IS 'Movie metadata and information';
COMMENT ON TABLE user_films IS 'User ratings and watch history for films';
COMMENT ON TABLE blends IS 'Compatibility calculations between user pairs';
COMMENT ON VIEW user_films_with_films IS 'Combined view of user films with film metadata';

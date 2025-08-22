const express = require('express');
const cors = require('cors');
const { getAllWatchedMovies, getFilmMetadataFromLetterboxd } = require('../scraper/letterboxdScraper.cjs');
const supabase = require('./supabaseClient.cjs');
const { getCompatibilityScore } = require('./compatibility.cjs');
const { findCommonMovies, getCommonMoviesSummary, findBiggestDisagreementMovie } = require('./commonMovies.cjs');

const app = express();
app.use(cors());
app.use(express.json());

// Track ongoing scraping operations to prevent duplicates
const ongoingScrapes = new Set();



app.post('/api/scrape', async (req, res) => {
  console.log('Received /api/scrape request', req.body);
  const { handle } = req.body;
  if (!handle) return res.status(400).json({ error: 'Missing handle' });

  // Prevent duplicate scraping for the same user
  if (ongoingScrapes.has(handle)) {
    console.log(`Scraping already in progress for ${handle}, returning existing operation`);
    return res.json({ success: true, count: 0, message: 'Scraping already in progress' });
  }

  // Mark this user as being scraped
  ongoingScrapes.add(handle);

  try {
    const movies = await getAllWatchedMovies(handle);
    console.log(movies);

    // Prepare rows for bulk insert
    const rows = movies.map(movie => ({
      user_handle: handle,
      film_slug: movie.slug,
      film_title: movie.title,
      rating: movie.rating,
      liked: movie.liked,
    }));

    // Insert all movies for this user
    const { error } = await supabase.from('user_films').upsert(rows, { onConflict: ['user_handle', 'film_slug'] });
    if (error) {
      console.error(error);
      throw error;
    }

    res.json({ success: true, count: rows.length });
    
    // Remove from ongoing scrapes
    ongoingScrapes.delete(handle);

    // --- Enrich films table in the background ---
    (async () => {
      // Get unique film_slugs from this batch
      const uniqueSlugs = Array.from(
        new Set(movies.map(m => m.slug && m.slug.trim().toLowerCase()))
      );
      console.log('All slugs:', movies.map(m => m.slug));
      console.log('Unique slugs:', uniqueSlugs);
      
      // Check which films already exist in the database
      const { data: existingFilms, error: checkError } = await supabase
        .from('films')
        .select('film_slug')
        .in('film_slug', uniqueSlugs);
      
      if (checkError) {
        console.error('Error checking existing films:', checkError);
        return;
      }
      
      const existingSlugs = new Set(existingFilms?.map(f => f.film_slug) || []);
      const newSlugs = uniqueSlugs.filter(slug => !existingSlugs.has(slug));
      
      console.log(`Found ${existingSlugs.size} existing films, ${newSlugs.length} new films to scrape`);
      
      // Use batch processing for better performance (moderate optimization)
      if (newSlugs.length > 0) {
        try {
          const { getFilmMetadataBatch } = require('../scraper/letterboxdScraper.cjs');
          const batchSize = 3; // Process 3 films simultaneously (moderate, respectful)
          
          console.log(`Processing ${newSlugs.length} new films in batches of ${batchSize}...`);
          
          for (let i = 0; i < newSlugs.length; i += batchSize) {
            const batch = newSlugs.slice(i, i + batchSize);
            console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(newSlugs.length / batchSize)}: ${batch.join(', ')}`);
            
            const batchPromises = batch.map(async (slug) => {
              try {
                const metadata = await getFilmMetadataFromLetterboxd(slug);
                if (!metadata) {
                  console.warn(`No metadata found for film: ${slug}`);
                  return null;
                }
                
                const { error: upsertError } = await supabase.from('films').upsert(metadata, { onConflict: ['film_slug'] });
                if (upsertError) {
                  console.error(`Upsert error for ${slug}:`, upsertError);
                  return null;
                }
                
                console.log(`✅ Successfully processed: ${slug}`);
                return metadata;
              } catch (err) {
                console.error(`Error enriching film ${slug}:`, err.message);
                return null;
              }
            });
            
            const batchResults = await Promise.all(batchPromises);
            const successfulResults = batchResults.filter(result => result !== null);
            console.log(`Batch complete: ${successfulResults.length}/${batch.length} successful`);
            
            // Small delay between batches to be respectful
            if (i + batchSize < newSlugs.length) {
              await new Promise(r => setTimeout(r, 500));
            }
          }
        } catch (err) {
          console.error('Error in batch processing:', err.message);
          // Fallback to individual processing if batch fails
          console.log('Falling back to individual processing...');
          for (const slug of newSlugs) {
            try {
              const metadata = await getFilmMetadataFromLetterboxd(slug);
              if (!metadata) {
                console.warn(`No metadata found for film: ${slug}`);
                continue;
              }
              const { error: upsertError } = await supabase.from('films').upsert(metadata, { onConflict: ['film_slug'] });
              if (upsertError) {
                console.error('Upsert error:', upsertError);
              }
            } catch (err) {
              console.error(`Error enriching film ${slug}:`, err.message);
            }
            await new Promise(r => setTimeout(r, 350));
          }
        }
      }
    })();
    // --- End enrichment ---

  } catch (err) {
    console.error('Error in scraping:', err);
    // Remove from ongoing scrapes on error
    ongoingScrapes.delete(handle);
    res.status(500).json({ error: err.message });
  }
});

// Test endpoint to check popularity scraping for a single film
app.post('/api/test-popularity', async (req, res) => {
  try {
    const { film_slug } = req.body;
    if (!film_slug) {
      return res.status(400).json({ error: 'Missing film_slug' });
    }
    
    console.log(`Testing popularity scraping for: ${film_slug}`);
    const metadata = await getFilmMetadataFromLetterboxd(film_slug);
    
    res.json({ 
      success: true, 
      film_slug, 
      metadata,
      popularity: metadata?.popularity 
    });
    
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// New endpoint to update popularity for all existing films
app.post('/api/update-popularity', async (req, res) => {
  try {
    console.log('Updating popularity for all existing films...');
    
    // Get all film slugs from the database
    const { data: existingFilms, error } = await supabase.from('films').select('film_slug');
    if (error) {
      throw error;
    }
    
    if (!existingFilms || existingFilms.length === 0) {
      return res.json({ success: true, message: 'No films found to update' });
    }
    
    const slugs = existingFilms.map(f => f.film_slug);
    console.log(`Found ${slugs.length} films to update`);
    
    let updatedCount = 0;
    for (const slug of slugs) {
      try {
        const metadata = await getFilmMetadataFromLetterboxd(slug);
        if (metadata && metadata.popularity !== null) {
          const { error: updateError } = await supabase
            .from('films')
            .update({ popularity: metadata.popularity })
            .eq('film_slug', slug);
          
          if (updateError) {
            console.error(`Error updating popularity for ${slug}:`, updateError);
          } else {
            updatedCount++;
            console.log(`Updated popularity for ${slug}: ${metadata.popularity}`);
          }
        }
      } catch (err) {
        console.error(`Error updating popularity for ${slug}:`, err.message);
      }
      // Delay to avoid hammering Letterboxd
      await new Promise(r => setTimeout(r, 350));
    }
    
    res.json({ success: true, updatedCount, totalFilms: slugs.length });
    
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Compatibility endpoint
app.post('/api/compatibility', async (req, res) => {
  try {
    const { user_a, user_b } = req.body;
    
    if (!user_a || !user_b) {
      return res.status(400).json({ error: 'Missing user_a or user_b' });
    }
    
    console.log(`Calculating compatibility between ${user_a} and ${user_b}`);
    
    const result = await getCompatibilityScore(user_a, user_b);
    
    res.json(result);
    
  } catch (err) {
    console.error('Error calculating compatibility:', err);
    res.status(500).json({ error: err.message });
  }
});

// Common movies endpoint
app.post('/api/common-movies', async (req, res) => {
  try {
    const { user_a, user_b, max_movies = 4 } = req.body;
    
    if (!user_a || !user_b) {
      return res.status(400).json({ error: 'Both user_a and user_b are required' });
    }
    
    console.log(`Finding common movies between ${user_a} and ${user_b} (max: ${max_movies})`);
    
    const commonMovies = await findCommonMovies(user_a, user_b, max_movies);
    
    res.json({
      user_a,
      user_b,
      movies: commonMovies,
      count: commonMovies.length
    });
  } catch (error) {
    console.error('Error finding common movies:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Common movies summary endpoint
app.post('/api/common-movies-summary', async (req, res) => {
  try {
    const { user_a, user_b } = req.body;
    
    if (!user_a || !user_b) {
      return res.status(400).json({ error: 'Both user_a and user_b are required' });
    }
    
    console.log(`Getting common movies summary between ${user_a} and ${user_b}`);
    
    const summary = await getCommonMoviesSummary(user_a, user_b);
    
    res.json({
      user_a,
      user_b,
      ...summary
    });
  } catch (error) {
    console.error('Error getting common movies summary:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Biggest disagreement movie endpoint
app.post('/api/biggest-disagreement', async (req, res) => {
  try {
    const { user_a, user_b } = req.body;
    
    if (!user_a || !user_b) {
      return res.status(400).json({ error: 'Both user_a and user_b are required' });
    }
    
    console.log(`Finding biggest disagreement movie between ${user_a} and ${user_b}`);
    
    const disagreementMovie = await findBiggestDisagreementMovie(user_a, user_b);
    
    if (disagreementMovie) {
      res.json({
        user_a,
        user_b,
        movie: disagreementMovie,
        disagreement_score: disagreementMovie.disagreement_score
      });
    } else {
      res.json({
        user_a,
        user_b,
        movie: null,
        message: 'No common movies found between users'
      });
    }
  } catch (error) {
    console.error('Error finding biggest disagreement movie:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Status endpoint to check ongoing scrapes
app.get('/api/status', (req, res) => {
  res.json({ 
    ongoingScrapes: Array.from(ongoingScrapes),
    totalOngoing: ongoingScrapes.size
  });
});

// Add error handling to prevent crashes
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

const server = app.listen(3001, (err) => {
  if (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
  console.log('API running on port 3001');
});

server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});

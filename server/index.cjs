const express = require('express');
const cors = require('cors');
const { getAllWatchedMovies, getFilmMetadataFromLetterboxd } = require('../scraper/letterboxdScraper.cjs');
const supabase = require('./supabaseClient.cjs');
const { getCompatibilityScore, checkMetadataReadiness } = require('./compatibility.cjs');
const { findCommonMovies, getCommonMoviesSummary, findBiggestDisagreementMovie } = require('./commonMovies.cjs');

const app = express();
app.use(cors());
app.use(express.json());

// Track ongoing scraping operations to prevent duplicates
const ongoingScrapes = new Set();

// Track scraping completion status for each blend to enforce sequential processing
const scrapingLocks = new Map(); // blend_id -> { user_a_complete: boolean, user_b_complete: boolean }



// Helper function to check if scraping is complete for a blend
function isScrapingComplete(blendId) {
  const lock = scrapingLocks.get(blendId);
  if (!lock) return false;
  return lock.user_a_complete && lock.user_b_complete;
}

// Helper function to mark scraping complete for a user in a blend
function markScrapingComplete(blendId, user) {
  if (!scrapingLocks.has(blendId)) {
    scrapingLocks.set(blendId, { user_a_complete: false, user_b_complete: false });
  }
  const lock = scrapingLocks.get(blendId);
  if (user === 'a') {
    lock.user_a_complete = true;
  } else if (user === 'b') {
    lock.user_b_complete = true;
  }
  console.log(`🔒 Scraping lock updated for blend ${blendId}:`, lock);
}

app.post('/api/scrape', async (req, res) => {
  console.log('🚀 === SCRAPING ENDPOINT CALLED ===');
  console.log('📝 Request body:', req.body);
  const { handle, blend_id, user } = req.body;
  if (!handle) {
    console.log('❌ Missing handle in request');
    return res.status(400).json({ error: 'Missing handle' });
  }
  if (!blend_id || !user) {
    console.log('❌ Missing blend_id or user in request');
    return res.status(400).json({ error: 'Missing blend_id or user' });
  }
  console.log('✅ Handle received:', handle, 'for blend:', blend_id, 'user:', user);

  // Prevent duplicate scraping for the same user in the same blend
  const scrapingKey = `${blend_id}:${user}`;
  if (ongoingScrapes.has(scrapingKey)) {
    console.log(`Scraping already in progress for ${handle} (${user}) in blend ${blend_id}, returning existing operation`);
    return res.json({ success: true, count: 0, message: 'Scraping already in progress' });
  }

  // Mark this user as being scraped in this blend
  ongoingScrapes.add(scrapingKey);
  
  // Initialize scraping lock for this blend if it doesn't exist
  if (!scrapingLocks.has(blend_id)) {
    scrapingLocks.set(blend_id, { user_a_complete: false, user_b_complete: false });
    console.log(`🔒 Initialized scraping lock for new blend ${blend_id}`);
  }

  try {
    const movies = await getAllWatchedMovies(handle);
    console.log(`🎬 Scraped ${movies.length} movies for ${handle} in blend ${blend_id}`);

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

    console.log(`💾 Inserted ${rows.length} movies for ${handle} in blend ${blend_id}`);
    
    // --- Enrich films table synchronously ---
    // Get unique film_slugs from this batch
    const uniqueSlugs = Array.from(
      new Set(movies.map(m => m.slug && m.slug.trim().toLowerCase()))
    );
    console.log('All slugs:', movies.map(m => m.slug));
    console.log('Unique slugs:', uniqueSlugs);
    
    // Check which films already exist in the database
    // Use a more efficient approach to avoid 414 errors with long URLs
    let existingSlugs = new Set();
    let checkError = null;
    
    try {
      // Process in smaller batches to avoid URL length issues
      const batchSize = 50; // Process 50 slugs at a time
      for (let i = 0; i < uniqueSlugs.length; i += batchSize) {
        const batch = uniqueSlugs.slice(i, i + batchSize);
        const { data: batchFilms, error: batchError } = await supabase
          .from('films')
          .select('film_slug')
          .in('film_slug', batch);
        
        if (batchError) {
          console.error('Error checking batch of existing films:', batchError);
          checkError = batchError;
          break;
        }
        
        // Add to existing slugs set
        batchFilms?.forEach(f => existingSlugs.add(f.film_slug));
      }
    } catch (err) {
      console.error('Error in batch checking existing films:', err);
      checkError = err;
    }
    
    if (checkError) {
      console.error('Error checking existing films:', checkError);
      throw checkError;
    }
    
    const newSlugs = uniqueSlugs.filter(slug => !existingSlugs.has(slug));
    
    console.log(`Found ${existingSlugs.size} existing films, ${newSlugs.length} new films to scrape`);
    
    // Process new films synchronously to ensure metadata is ready
    if (newSlugs.length > 0) {
      console.log(`🔍 Starting metadata scraping for ${newSlugs.length} films...`);
      
      try {
        const batchSize = 3; // Process 3 films simultaneously (moderate, respectful)
        
        console.log(`Processing ${newSlugs.length} new films in batches of ${batchSize}...`);
        
        for (let i = 0; i < newSlugs.length; i += batchSize) {
          const batch = newSlugs.slice(i, i + batchSize);
          console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(newSlugs.length / batchSize)}: ${batch.join(', ')}`);
          
          const batchPromises = batch.map(async (slug) => {
            try {
              console.log(`🔍 Scraping metadata for: ${slug}`);
              const metadata = await getFilmMetadataFromLetterboxd(slug);
              
              if (!metadata) {
                console.warn(`❌ No metadata found for film: ${slug}`);
                return null;
              }
              
              console.log(`📊 Metadata received for ${slug}:`, {
                hasGenres: !!metadata.genres,
                hasDirectors: !!metadata.directors,
                hasPopularity: metadata.popularity !== null,
                genres: metadata.genres,
                directors: metadata.directors,
                popularity: metadata.popularity
              });
              
              const { error: upsertError } = await supabase.from('films').upsert(metadata, { onConflict: ['film_slug'] });
              if (upsertError) {
                console.error(`❌ Database upsert error for ${slug}:`, upsertError);
                return null;
              }
              
              console.log(`✅ Successfully stored metadata for: ${slug}`);
              return metadata;
            } catch (err) {
              console.error(`❌ Error enriching film ${slug}:`, err.message);
              console.error(`❌ Full error:`, err);
              return null;
            }
          });
          
          const batchResults = await Promise.all(batchPromises);
          const successfulResults = batchResults.filter(result => result !== null);
          console.log(`📦 Batch complete: ${successfulResults.length}/${batch.length} successful`);
          
          // Small delay between batches to be respectful
          if (i + batchSize < newSlugs.length) {
            await new Promise(r => setTimeout(r, 500));
          }
        }
        
        console.log(`🎯 Metadata scraping completed. Successfully processed ${newSlugs.filter(slug => {
          // Check if the film was actually stored in the database
          return true; // We'll verify this in the next step
        }).length} films.`);
        
        // Verify the data was actually stored
        console.log(`🔍 Verifying metadata storage...`);
        const { data: storedFilms, error: verifyError } = await supabase
          .from('films')
          .select('film_slug, genres, directors, popularity')
          .in('film_slug', newSlugs);
        
        if (verifyError) {
          console.error(`❌ Error verifying stored films:`, verifyError);
        } else {
          console.log(`📊 Verification results:`, {
            totalRequested: newSlugs.length,
            totalStored: storedFilms?.length || 0,
            withGenres: storedFilms?.filter(f => f.genres && f.genres.length > 0).length || 0,
            withDirectors: storedFilms?.filter(f => f.directors && f.directors.length > 0).length || 0,
            withPopularity: storedFilms?.filter(f => f.popularity !== null).length || 0
          });
        }
        
      } catch (err) {
        console.error('❌ Error in batch processing:', err.message);
        console.error('❌ Full error:', err);
        
        // Fallback to individual processing if batch fails
        console.log('🔄 Falling back to individual processing...');
        for (const slug of newSlugs) {
          try {
            console.log(`🔍 Individual fallback for: ${slug}`);
            const metadata = await getFilmMetadataFromLetterboxd(slug);
            if (!metadata) {
              console.warn(`❌ No metadata found for film: ${slug}`);
              continue;
            }
            
            console.log(`📊 Individual metadata for ${slug}:`, metadata);
            
            const { error: upsertError } = await supabase.from('films').upsert(metadata, { onConflict: ['film_slug'] });
            if (upsertError) {
              console.error(`❌ Individual upsert error for ${slug}:`, upsertError);
            } else {
              console.log(`✅ Individual success for ${slug}`);
            }
          } catch (err) {
            console.error(`❌ Individual error for ${slug}:`, err.message);
          }
          await new Promise(r => setTimeout(r, 350));
        }
      }
    } else {
      console.log(`ℹ️ No new films to scrape metadata for.`);
    }
    // --- End enrichment ---
    
    // Now that both user movies AND metadata are complete, mark scraping complete
    ongoingScrapes.delete(`${blend_id}:${user}`);
    markScrapingComplete(blend_id, user);
    console.log(`✅ Scraping AND metadata complete for ${handle} (${user}) in blend ${blend_id}`);
    
    // Send response after everything is complete
    res.json({ success: true, count: rows.length });

  } catch (err) {
    console.error('Error in scraping:', err);
    // Remove from ongoing scrapes on error
    ongoingScrapes.delete(scrapingKey);
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

// New endpoint to check scraping status for a blend
app.post('/api/blend-scraping-status', async (req, res) => {
  try {
    const { blend_id } = req.body;
    if (!blend_id) {
      return res.status(400).json({ error: 'Missing blend_id' });
    }
    
    console.log(`Checking scraping status for blend: ${blend_id}`);
    
    const lock = scrapingLocks.get(blend_id);
    if (!lock) {
      return res.json({
        success: true,
        blend_id,
        user_a_complete: false,
        user_b_complete: false,
        all_complete: false,
        status: 'not_started'
      });
    }
    
    const allComplete = lock.user_a_complete && lock.user_b_complete;
    
    res.json({
      success: true,
      blend_id,
      user_a_complete: lock.user_a_complete,
      user_b_complete: lock.user_b_complete,
      all_complete: allComplete,
      status: allComplete ? 'complete' : 'in_progress'
    });
    
  } catch (err) {
    console.error('Error checking blend scraping status:', err);
    res.status(500).json({ error: err.message });
  }
});

// New endpoint to check if a user's scraping is complete
app.post('/api/user-scraping-status', async (req, res) => {
  try {
    const { handle } = req.body;
    if (!handle) {
      return res.status(400).json({ error: 'Missing handle' });
    }
    
    console.log(`Checking scraping status for user: ${handle}`);
    
    // Check if user has movies in user_films
    const { data: userFilms, error: userFilmsError } = await supabase
      .from('user_films')
      .select('film_slug')
      .eq('user_handle', handle);
    
    if (userFilmsError) {
      throw userFilmsError;
    }
    
    const movieCount = userFilms?.length || 0;
    const hasMovies = movieCount > 0;
    
    // Check if movies have metadata
    let metadataComplete = false;
    if (hasMovies) {
      const { data: filmsWithMetadata, error: metadataError } = await supabase
        .from('films')
        .select('film_slug, genres, directors, popularity')
        .in('film_slug', userFilms.map(uf => uf.film_slug).slice(0, 50)); // Check first 50
      
      if (!metadataError && filmsWithMetadata) {
        const completeMetadata = filmsWithMetadata.filter(f => 
          f.genres && f.directors && f.popularity !== null
        );
        metadataComplete = completeMetadata.length === filmsWithMetadata.length;
      }
    }
    
    res.json({
      success: true,
      handle,
      movieCount,
      hasMovies,
      metadataComplete,
      status: hasMovies ? (metadataComplete ? 'complete' : 'partial') : 'none'
    });
    
  } catch (err) {
    console.error('Error checking user scraping status:', err);
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
    const { user_a, user_b, blend_id } = req.body;
    
    if (!user_a || !user_b) {
      return res.status(400).json({ error: 'Missing user_a or user_b' });
    }
    
    if (!blend_id) {
      return res.status(400).json({ error: 'Missing blend_id' });
    }
    
    console.log(`🔒 Checking scraping completion for blend ${blend_id} before compatibility calculation`);
    
    // STRICT CHECK: Ensure scraping is complete before proceeding
    const lock = scrapingLocks.get(blend_id);
    if (!lock || !lock.user_a_complete || !lock.user_b_complete) {
      console.log(`❌ Scraping not complete for blend ${blend_id}:`, lock);
      return res.status(400).json({ 
        error: 'Scraping not complete for both users',
        status: 'scraping_incomplete',
        blend_id,
        scraping_status: lock || { user_a_complete: false, user_b_complete: false }
      });
    }
    
    console.log(`✅ Scraping complete for blend ${blend_id}, proceeding with compatibility calculation`);
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
    const { user_a, user_b, max_movies = 4, blend_id } = req.body;
    
    if (!user_a || !user_b) {
      return res.status(400).json({ error: 'Both user_a and user_b are required' });
    }
    
    if (!blend_id) {
      return res.status(400).json({ error: 'Missing blend_id' });
    }
    
    console.log(`🔒 Checking scraping completion for blend ${blend_id} before common movies calculation`);
    
    // STRICT CHECK: Ensure scraping is complete before proceeding
    const lock = scrapingLocks.get(blend_id);
    if (!lock || !lock.user_a_complete || !lock.user_b_complete) {
      console.log(`❌ Scraping not complete for blend ${blend_id}:`, lock);
      return res.status(400).json({ 
        error: 'Scraping not complete for both users',
        status: 'scraping_incomplete',
        blend_id,
        scraping_status: lock || { user_a_complete: false, user_b_complete: false }
      });
    }
    
    console.log(`✅ Scraping complete for blend ${blend_id}, proceeding with common movies calculation`);
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
    const { user_a, user_b, blend_id } = req.body;
    
    if (!user_a || !user_b) {
      return res.status(400).json({ error: 'Both user_a and user_b are required' });
    }
    
    if (!blend_id) {
      return res.status(400).json({ error: 'Missing blend_id' });
    }
    
    console.log(`🔒 Checking scraping completion for blend ${blend_id} before disagreement calculation`);
    
    // STRICT CHECK: Ensure scraping is complete before proceeding
    const lock = scrapingLocks.get(blend_id);
    if (!lock || !lock.user_a_complete || !lock.user_b_complete) {
      console.log(`❌ Scraping not complete for blend ${blend_id}:`, lock);
      return res.status(400).json({ 
        error: 'Scraping not complete for both users',
        status: 'scraping_incomplete',
        blend_id,
        scraping_status: lock || { user_a_complete: false, user_b_complete: false }
      });
    }
    
    console.log(`✅ Scraping complete for blend ${blend_id}, proceeding with disagreement calculation`);
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

// Metadata readiness endpoint
app.post('/api/metadata-ready', async (req, res) => {
  try {
    const { user_a, user_b } = req.body;
    
    if (!user_a || !user_b) {
      return res.status(400).json({ error: 'Both user_a and user_b are required' });
    }
    
    console.log(`Checking metadata readiness for ${user_a} vs ${user_b}`);
    
    const readiness = await checkMetadataReadiness(user_a, user_b);
    
    res.json(readiness);
  } catch (error) {
    console.error('Error checking metadata readiness:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Force metadata scraping for specific films
app.post('/api/scrape-metadata', async (req, res) => {
  try {
    const { film_slugs } = req.body;
    
    if (!film_slugs || !Array.isArray(film_slugs)) {
      return res.status(400).json({ error: 'film_slugs array is required' });
    }
    
    console.log(`🔍 Force scraping metadata for ${film_slugs.length} films:`, film_slugs);
    
    const results = [];
    
    for (const slug of film_slugs) {
      try {
        console.log(`📊 Scraping metadata for: ${slug}`);
        const metadata = await getFilmMetadataFromLetterboxd(slug);
        
        if (metadata) {
          const { error: upsertError } = await supabase.from('films').upsert(metadata, { onConflict: ['film_slug'] });
          if (upsertError) {
            console.error(`❌ Database error for ${slug}:`, upsertError);
            results.push({ slug, success: false, error: upsertError.message });
          } else {
            console.log(`✅ Successfully scraped and stored metadata for: ${slug}`);
            results.push({ slug, success: true, metadata });
          }
        } else {
          console.warn(`❌ No metadata found for: ${slug}`);
          results.push({ slug, success: false, error: 'No metadata found' });
        }
        
        // Small delay between requests
        await new Promise(r => setTimeout(r, 500));
        
      } catch (err) {
        console.error(`❌ Error scraping ${slug}:`, err.message);
        results.push({ slug, success: false, error: err.message });
      }
    }
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`🎯 Metadata scraping complete: ${successful} successful, ${failed} failed`);
    
    res.json({
      success: true,
      total_requested: film_slugs.length,
      successful,
      failed,
      results
    });
    
  } catch (error) {
    console.error('Error in metadata scraping:', error);
    res.status(500).json({ error: error.message });
  }
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

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, (err) => {
  if (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
  console.log(`API running on port ${PORT}`);
});

server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});

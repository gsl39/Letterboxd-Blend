const express = require('express');
const cors = require('cors');
const { getAllWatchedMovies, getFilmMetadataFromLetterboxd } = require('../scraper/letterboxdScraper.cjs');
const supabase = require('./supabaseClient.cjs');
const { getCompatibilityScore } = require('./compatibility.cjs');
const { findCommonMovies, getCommonMoviesSummary, findBiggestDisagreementMovie } = require('./commonMovies.cjs');

const app = express();

// CORS configuration
app.use(cors());
app.use(express.json());

// Track ongoing scrapes to prevent duplicates
const ongoingScrapes = new Set();

// Function to get user films data from Supabase
async function getUserFilmsData(userHandle) {
  try {
    let allMovies = [];
    let offset = 0;
    const batchSize = 1000;
    let data;
    
    do {
      const result = await supabase
        .from('user_films_with_films')
        .select('*')
        .eq('user_handle', userHandle)
        .range(offset, offset + batchSize - 1);
      
      data = result.data;
      const { error } = result;
      
      if (error) {
        console.error(`Error fetching batch for ${userHandle}:`, error);
        break;
      }
      
      if (data && data.length > 0) {
        allMovies = allMovies.concat(data);
      }
      
      offset += batchSize;
    } while (data && data.length === batchSize);
    
    return allMovies;
  } catch (err) {
    console.error(`Error fetching data for user ${userHandle}:`, err);
    return [];
  }
}

// Function to check metadata readiness
async function checkMetadataReadiness(userA, userB) {
  try {
    const userAFilms = await getUserFilmsData(userA);
    const userBFilms = await getUserFilmsData(userB);
    
    if (userAFilms.length === 0 || userBFilms.length === 0) {
      return { ready: false, error: "One or both users have no films" };
    }
    
    const userAMetadataCount = userAFilms.filter(film => 
      film.genres !== null || film.directors !== null || film.popularity !== null
    ).length;
    
    const userBMetadataCount = userBFilms.filter(film => 
      film.genres !== null || film.directors !== null || film.popularity !== null
    ).length;
    
    const userAMetadataPercentage = (userAMetadataCount / userAFilms.length) * 100;
    const userBMetadataPercentage = (userBMetadataCount / userBFilms.length) * 100;
    
    const userAReady = userAMetadataPercentage >= 90;
    const userBReady = userBMetadataPercentage >= 90;
    const bothReady = userAReady && userBReady;
    
    return {
      ready: bothReady,
      user_a: userA,
      user_b: userB,
      metadata_status: {
        user_a_total: userAFilms.length,
        user_b_total: userBFilms.length,
        user_a_with_metadata: userAMetadataCount,
        user_b_with_metadata: userBMetadataCount,
        user_a_percentage: Math.round(userAMetadataPercentage * 10) / 10,
        user_b_percentage: Math.round(userBMetadataPercentage * 10) / 10,
        user_a_ready: userAReady,
        user_b_ready: userBReady
      }
    };
    
  } catch (err) {
    console.error('Error checking metadata readiness:', err);
    return { ready: false, error: err.message };
  }
}

// Scraping endpoint for StartBlendPage
app.post('/api/scrape-start-blend', async (req, res) => {
  const { blend_id } = req.body;
  
  if (!blend_id) {
    return res.status(400).json({ error: 'Missing blend_id' });
  }

  const scrapingKey = `${blend_id}:start_blend`;
  
  if (ongoingScrapes.has(scrapingKey)) {
    return res.status(400).json({ error: 'Scraping already in progress for this blend' });
  }

  try {
    ongoingScrapes.add(scrapingKey);
    
    // Get both users from the blend
    const { data: blendData } = await supabase
      .from('blends')
      .select('user_a, user_b')
      .eq('blend_id', blend_id)
      .single();
    
    if (!blendData || !blendData.user_a || !blendData.user_b) {
      throw new Error('Both users must be present in the blend');
    }
    
    console.log(`🚀 Starting scraping for both users: ${blendData.user_a} and ${blendData.user_b}`);
    
    // Scrape User A
    const userAMovies = await getAllWatchedMovies(blendData.user_a);
    console.log(`Scraped ${userAMovies.length} movies for ${blendData.user_a}`);
    
    const userARows = userAMovies.map(movie => ({
      user_handle: blendData.user_a,
      film_slug: movie.slug,
      film_title: movie.title,
      rating: movie.rating,
      liked: movie.liked,
    }));
    
    await supabase.from('user_films').upsert(userARows, { onConflict: ['user_handle', 'film_slug'] });
    
    // Scrape User B
    const userBMovies = await getAllWatchedMovies(blendData.user_b);
    console.log(`Scraped ${userBMovies.length} movies for ${blendData.user_b}`);
    
    const userBRows = userBMovies.map(movie => ({
      user_handle: blendData.user_b,
      film_slug: movie.slug,
      film_title: movie.title,
      rating: movie.rating,
      liked: movie.liked,
    }));
    
    await supabase.from('user_films').upsert(userBRows, { onConflict: ['user_handle', 'film_slug'] });
    
    // Scrape metadata for all unique films from both users
    const allMovies = [...userAMovies, ...userBMovies];
    const uniqueSlugs = Array.from(new Set(allMovies.map(m => m.slug && m.slug.trim().toLowerCase())));
    
    // Check which films already exist
    let existingSlugs = new Set();
    const batchSize = 50;
    
    for (let i = 0; i < uniqueSlugs.length; i += batchSize) {
      const batch = uniqueSlugs.slice(i, i + batchSize);
      const { data: batchFilms, error: batchError } = await supabase
        .from('films')
        .select('film_slug')
        .in('film_slug', batch);
      
      if (batchError) {
        console.error('Error checking existing films:', batchError);
        break;
      }
      
      batchFilms?.forEach(f => existingSlugs.add(f.film_slug));
    }
    
    const newSlugs = uniqueSlugs.filter(slug => !existingSlugs.has(slug));
    
    // Scrape metadata for new films
    if (newSlugs.length > 0) {
      console.log(`Scraping metadata for ${newSlugs.length} new films...`);
      
      for (const slug of newSlugs) {
        try {
          const metadata = await getFilmMetadataFromLetterboxd(slug);
          if (metadata) {
            await supabase.from('films').upsert(metadata, { onConflict: ['film_slug'] });
            console.log(`Scraped metadata for: ${slug}`);
          }
          await new Promise(r => setTimeout(r, 500)); // Rate limiting
        } catch (err) {
          console.error(`Error scraping ${slug}:`, err.message);
        }
      }
    }
    
    ongoingScrapes.delete(scrapingKey);
    res.json({ 
      success: true, 
      user_a_count: userARows.length,
      user_b_count: userBRows.length,
      total_movies: userARows.length + userBRows.length
    });

  } catch (err) {
    console.error('Error in scraping both users:', err);
    ongoingScrapes.delete(scrapingKey);
    res.status(500).json({ error: err.message });
  }
});

// Scraping endpoint for ScrapingPage
app.post('/api/scrape-join-blend', async (req, res) => {
  const { blend_id } = req.body;
  
  if (!blend_id) {
    return res.status(400).json({ error: 'Missing blend_id' });
  }

  const scrapingKey = `${blend_id}:join_blend`;
  
  if (ongoingScrapes.has(scrapingKey)) {
    return res.status(400).json({ error: 'Scraping already in progress for this blend' });
  }

  try {
    ongoingScrapes.add(scrapingKey);
    
    // Get both users from the blend
    const { data: blendData } = await supabase
      .from('blends')
      .select('user_a, user_b')
      .eq('blend_id', blend_id)
      .single();
    
    if (!blendData || !blendData.user_a || !blendData.user_b) {
      throw new Error('Both users must be present in the blend');
    }
    
    console.log(`🚀 Starting scraping for both users: ${blendData.user_a} and ${blendData.user_b}`);
    
    // Scrape User A
    const userAMovies = await getAllWatchedMovies(blendData.user_a);
    console.log(`Scraped ${userAMovies.length} movies for ${blendData.user_a}`);
    
    const userARows = userAMovies.map(movie => ({
      user_handle: blendData.user_a,
      film_slug: movie.slug,
      film_title: movie.title,
      rating: movie.rating,
      liked: movie.liked,
    }));
    
    await supabase.from('user_films').upsert(userARows, { onConflict: ['user_handle', 'film_slug'] });
    
    // Scrape User B
    const userBMovies = await getAllWatchedMovies(blendData.user_b);
    console.log(`Scraped ${userBMovies.length} movies for ${blendData.user_b}`);
    
    const userBRows = userBMovies.map(movie => ({
      user_handle: blendData.user_b,
      film_slug: movie.slug,
      film_title: movie.title,
      rating: movie.rating,
      liked: movie.liked,
    }));
    
    await supabase.from('user_films').upsert(userBRows, { onConflict: ['user_handle', 'film_slug'] });
    
    // Scrape metadata for all unique films from both users
    const allMovies = [...userAMovies, ...userBMovies];
    const uniqueSlugs = Array.from(new Set(allMovies.map(m => m.slug && m.slug.trim().toLowerCase())));
    
    // Check which films already exist
    let existingSlugs = new Set();
    const batchSize = 50;
    
    for (let i = 0; i < uniqueSlugs.length; i += batchSize) {
      const batch = uniqueSlugs.slice(i, i + batchSize);
      const { data: batchFilms, error: batchError } = await supabase
        .from('films')
        .select('film_slug')
        .in('film_slug', batch);
      
      if (batchError) {
        console.error('Error checking existing films:', batchError);
        break;
      }
      
      batchFilms?.forEach(f => existingSlugs.add(f.film_slug));
    }
    
    const newSlugs = uniqueSlugs.filter(slug => !existingSlugs.has(slug));
    
    // Scrape metadata for new films
    if (newSlugs.length > 0) {
      console.log(`Scraping metadata for ${newSlugs.length} new films...`);
      
      for (const slug of newSlugs) {
        try {
          const metadata = await getFilmMetadataFromLetterboxd(slug);
          if (metadata) {
            await supabase.from('films').upsert(metadata, { onConflict: ['film_slug'] });
            console.log(`Scraped metadata for: ${slug}`);
          }
          await new Promise(r => setTimeout(r, 500)); // Rate limiting
        } catch (err) {
          console.error(`Error scraping ${slug}:`, err.message);
        }
      }
    }
    
    ongoingScrapes.delete(scrapingKey);
    res.json({ 
      success: true, 
      user_a_count: userARows.length,
      user_b_count: userBRows.length,
      total_movies: userARows.length + userBRows.length
    });

  } catch (err) {
    console.error('Error in scraping both users:', err);
    ongoingScrapes.delete(scrapingKey);
    res.status(500).json({ error: err.message });
  }
});

// Final status endpoint
app.post('/api/blend-final-status', async (req, res) => {
  try {
    const { blend_id } = req.body;
    if (!blend_id) {
      return res.status(400).json({ error: 'Missing blend_id' });
    }
    
    // Get blend details
    const { data: blendData } = await supabase
      .from('blends')
      .select('user_a, user_b')
      .eq('blend_id', blend_id)
      .single();
    
    if (!blendData) {
      return res.json({ ready: false, error: 'Blend not found' });
    }
    
    // Check metadata readiness
    const metadataStatus = await checkMetadataReadiness(blendData.user_a, blendData.user_b);
    
    return res.json({
      success: true,
      blend_id,
      ready: metadataStatus.ready,
      metadata_status: metadataStatus
    });
    
  } catch (err) {
    console.error('Error getting final blend status:', err);
    res.status(500).json({ error: err.message });
  }
});

// Compatibility endpoint
app.post('/api/compatibility', async (req, res) => {
  try {
    const { user_a, user_b, blend_id } = req.body;
    
    if (!user_a || !user_b || !blend_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
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
    
    if (!user_a || !user_b || !blend_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
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
    
    if (!user_a || !user_b || !blend_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
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

// Status endpoint
app.get('/api/status', (req, res) => {
  res.json({ 
    ongoingScrapes: Array.from(ongoingScrapes),
    totalOngoing: ongoingScrapes.size
  });
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
const supabase = require('./supabaseClient.cjs');
const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Find up to 4 common movies between two users, starting with 5-star films and working down
 * @param {string} userA - First user's Letterboxd handle
 * @param {string} userB - Second user's Letterboxd handle
 * @param {number} maxMovies - Maximum number of movies to return (default: 4)
 * @returns {Promise<Array>} Array of common movies with metadata, up to maxMovies
 */
async function findCommonMovies(userA, userB, maxMovies = 4) {
  try {
    console.log(`Finding up to ${maxMovies} common movies between ${userA} and ${userB}`);
    
    const ratings = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5];
    let allCommonMovies = [];
    
    // 1. Start with common 5★ × 5★ movies (both love it)
    console.log('Checking 5★ × 5★ movies...');
    const { data: userAFiveStars, error: errorA5 } = await supabase
      .from('user_films_with_films')
      .select('*')
      .eq('user_handle', userA)
      .eq('rating', 5);

    const { data: userBFiveStars, error: errorB5 } = await supabase
      .from('user_films_with_films')
      .select('*')
      .eq('user_handle', userB)
      .eq('rating', 5);

    if (errorA5 || errorB5) {
      console.error('Error fetching 5-star movies:', errorA5 || errorB5);
    } else {
      // Find common 5★ × 5★ movies
      const userAFiveStarSlugs = new Set(userAFiveStars.map(movie => movie.film_slug));
      const userBFiveStarSlugs = new Set(userBFiveStars.map(movie => movie.film_slug));
      const commonFiveStarSlugs = [...userAFiveStarSlugs].filter(slug => userBFiveStarSlugs.has(slug));
      
      console.log(`Found ${commonFiveStarSlugs.length} common 5★ × 5★ movies`);
      
      // Add common 5★ × 5★ movies
      const fiveStarMovies = commonFiveStarSlugs.map(filmSlug => {
        const userAMovie = userAFiveStars.find(movie => movie.film_slug === filmSlug);
        const userBMovie = userBFiveStars.find(movie => movie.film_slug === filmSlug);
        
        return {
          film_slug: filmSlug,
          title: filmSlug,
          year: 'N/A',
          poster_url: null, // Will be updated with actual poster URL
          letterboxd_slug: filmSlug,
          user_a_rating: userAMovie.rating,
          user_b_rating: userBMovie.rating,
          match_strength: 'perfect'
        };
      });
      
      // Randomly shuffle and add 5★ × 5★ movies
      const shuffledFiveStars = fiveStarMovies.sort(() => Math.random() - 0.5);
      const remainingSlots = maxMovies - allCommonMovies.length;
      const fiveStarsToAdd = shuffledFiveStars.slice(0, remainingSlots);
      allCommonMovies.push(...fiveStarsToAdd);
      
      console.log(`Added ${fiveStarsToAdd.length} 5★ × 5★ movies. Total: ${allCommonMovies.length}`);
    }
    
    // 2. If we still need movies, look for mixed 5★ × 4.5★ (one loves it, one really likes it)
    if (allCommonMovies.length < maxMovies) {
      console.log('Looking for mixed 5★ × 4.5★ movies...');
      
      const { data: userAFourHalfStars, error: errorA45 } = await supabase
        .from('user_films_with_films')
        .select('*')
        .eq('user_handle', userA)
        .eq('rating', 4.5);

      const { data: userBFourHalfStars, error: errorB45 } = await supabase
        .from('user_films_with_films')
        .select('*')
        .eq('user_handle', userB)
        .eq('rating', 4.5);

      if (!errorA45 && !errorB45) {
        // Find movies where user A gave 5★ and user B gave 4.5★
        const mixedFiveFourHalf = userAFiveStars
          .filter(movieA => userBFourHalfStars.some(movieB => movieB.film_slug === movieA.film_slug))
          .map(movieA => {
            const movieB = userBFourHalfStars.find(m => m.film_slug === movieA.film_slug);
            return {
              film_slug: movieA.film_slug,
              title: movieA.film_slug,
              year: 'N/A',
              poster_url: null,
              letterboxd_slug: movieA.film_slug,
              user_a_rating: movieA.rating,
              user_b_rating: movieB.rating,
              match_strength: 'excellent'
            };
          });
        
        // Also check the reverse (user B gave 5★, user A gave 4.5★)
        const mixedFourHalfFive = userBFiveStars
          .filter(movieB => userAFourHalfStars.some(movieA => movieA.film_slug === movieB.film_slug))
          .map(movieB => {
            const movieA = userAFourHalfStars.find(m => m.film_slug === movieB.film_slug);
            return {
              film_slug: movieB.film_slug,
              title: movieB.film_slug,
              year: 'N/A',
              poster_url: null,
              letterboxd_slug: movieB.film_slug,
              user_a_rating: movieA.rating,
              user_b_rating: movieB.rating,
              match_strength: 'excellent'
            };
          });
        
        // Combine and deduplicate mixed ratings
        const allMixed = [...mixedFiveFourHalf, ...mixedFourHalfFive];
        const uniqueMixed = allMixed.filter((movie, index, self) => 
          index === self.findIndex(m => m.film_slug === movie.film_slug)
        );
        
        console.log(`Found ${uniqueMixed.length} mixed 5★ × 4.5★ movies`);
        
        // Add mixed movies until we reach maxMovies
        const remainingSlots = maxMovies - allCommonMovies.length;
        const shuffledMixed = uniqueMixed.sort(() => Math.random() - 0.5);
        const mixedToAdd = shuffledMixed.slice(0, remainingSlots);
        
        allCommonMovies.push(...mixedToAdd);
        console.log(`Added ${mixedToAdd.length} mixed 5★ × 4.5★ movies. Total: ${allCommonMovies.length}`);
      }
    }
    
    // 3. Finally, if we still need movies, look for common 4.5★ × 4.5★ (both really like it)
    if (allCommonMovies.length < maxMovies) {
      console.log('Looking for common 4.5★ × 4.5★ movies...');
      
      const { data: userAFourHalfStars, error: errorA45 } = await supabase
        .from('user_films_with_films')
        .select('*')
        .eq('user_handle', userA)
        .eq('rating', 4.5);

      const { data: userBFourHalfStars, error: errorB45 } = await supabase
        .from('user_films_with_films')
        .select('*')
        .eq('user_handle', userB)
        .eq('rating', 4.5);

      if (!errorA45 && !errorB45) {
        const commonFourHalfStarSlugs = [...userAFourHalfStars.map(m => m.film_slug)]
          .filter(slug => userBFourHalfStars.some(m => m.film_slug === slug));
        
        console.log(`Found ${commonFourHalfStarSlugs.length} common 4.5★ × 4.5★ movies`);
        
        const fourHalfStarMovies = commonFourHalfStarSlugs.map(filmSlug => {
          const userAMovie = userAFourHalfStars.find(movie => movie.film_slug === filmSlug);
          const userBMovie = userBFourHalfStars.find(movie => movie.film_slug === filmSlug);
          
          return {
            film_slug: filmSlug,
            title: filmSlug,
            year: 'N/A',
            poster_url: null,
            letterboxd_slug: filmSlug,
            user_a_rating: userAMovie.rating,
            user_b_rating: userBMovie.rating,
            match_strength: 'excellent'
          };
        });
        
        // Add common 4.5★ × 4.5★ movies
        const remainingSlots = maxMovies - allCommonMovies.length;
        const shuffledFourHalfStars = fourHalfStarMovies.sort(() => Math.random() - 0.5);
        const fourHalfStarsToAdd = shuffledFourHalfStars.slice(0, remainingSlots);
        
        allCommonMovies.push(...fourHalfStarsToAdd);
        console.log(`Added ${fourHalfStarsToAdd.length} 4.5★ × 4.5★ movies. Total: ${allCommonMovies.length}`);
      }
    }
    


    // Sort by rating (highest first), then alphabetically
    allCommonMovies.sort((a, b) => {
      // First sort by rating (highest first)
      if (b.user_a_rating !== a.user_a_rating) {
        return b.user_a_rating - a.user_a_rating;
      }
      // Then alphabetically by title
      return a.title.localeCompare(b.title);
    });

    console.log(`Final result: ${allCommonMovies.length} common movies found`);
    
    // Fetch poster URLs for the movies
    if (allCommonMovies.length > 0) {
      console.log('Fetching poster URLs for common movies...');
      
      for (let movie of allCommonMovies) {
        try {
          const { data: filmData, error } = await supabase
            .from('films')
            .select('poster_url')
            .eq('film_slug', movie.film_slug)
            .single();
          
          if (!error && filmData && filmData.poster_url) {
            movie.poster_url = filmData.poster_url;
            console.log(`Found poster for ${movie.film_slug}: ${filmData.poster_url}`);
          } else {
            console.log(`No poster found for ${movie.film_slug}`);
          }
        } catch (err) {
          console.log(`Error fetching poster for ${movie.film_slug}:`, err.message);
        }
      }
    }
    
    return allCommonMovies;

  } catch (error) {
    console.error('Error finding common movies:', error);
    return [];
  }
}

/**
 * Get a summary of common movie preferences between two users
 * @param {string} userA - First user's Letterboxd handle
 * @param {string} userB - Second user's Letterboxd handle
 * @returns {Promise<Object>} Summary object with counts and insights
 */
async function getCommonMoviesSummary(userA, userB) {
  try {
    const commonMovies = await findCommonMovies(userA, userB, 100); // Get more for summary
    
    // Group by decade for insights
    const byDecade = {};
    commonMovies.forEach(movie => {
      const decade = Math.floor(movie.year / 10) * 10;
      if (!byDecade[decade]) {
        byDecade[decade] = [];
      }
      byDecade[decade].push(movie);
    });

    // Find most common genres (if we had genre data)
    const insights = {
      total_common_five_star: commonMovies.filter(m => m.user_a_rating === 5).length,
      total_common_four_plus: commonMovies.filter(m => m.user_a_rating >= 4).length,
      by_decade: byDecade,
      newest_movie: commonMovies[0] || null,
      oldest_movie: commonMovies[commonMovies.length - 1] || null,
      perfect_matches: commonMovies.filter(movie => movie.match_strength === 'perfect').length
    };

    return {
      movies: commonMovies,
      summary: insights
    };

  } catch (error) {
    console.error('Error getting common movies summary:', error);
    return { movies: [], summary: {} };
  }
}

/**
 * Find the movie with the biggest rating disagreement between two users
 * Uses prioritization logic: highest disagreement → both reviews → one review → random
 * @param {string} userA - First user's Letterboxd handle
 * @param {string} userB - Second user's Letterboxd handle
 * @returns {Promise<Object|null>} Movie with biggest disagreement or null if no common movies
 */
async function findBiggestDisagreementMovie(userA, userB) {
  try {
    console.log(`Finding biggest disagreement movie between ${userA} and ${userB}`);
    
    // Get all movies that both users have rated
    const { data: userAMovies, error: errorA } = await supabase
      .from('user_films_with_films')
      .select('*')
      .eq('user_handle', userA);

    const { data: userBMovies, error: errorB } = await supabase
      .from('user_films_with_films')
      .select('*')
      .eq('user_handle', userB);

    if (errorA || errorB) {
      console.error('Error fetching user movies:', errorA || errorB);
      return null;
    }

    console.log(`User A has ${userAMovies.length} movies, User B has ${userBMovies.length} movies`);

    // Create maps for faster lookup
    const userAMovieMap = new Map(userAMovies.map(movie => [movie.film_slug, movie]));
    const userBMovieMap = new Map(userBMovies.map(movie => [movie.film_slug, movie]));

    // Find all common movies and calculate disagreement scores
    const commonMovies = [];
    for (const [slug, userAMovie] of userAMovieMap) {
      const userBMovie = userBMovieMap.get(slug);
      if (userBMovie) {
        // Debug logging to see what's happening
        console.log(`Checking movie ${slug}: userA rating = ${userAMovie.rating} (type: ${typeof userAMovie.rating}), userB rating = ${userBMovie.rating} (type: ${typeof userBMovie.rating})`);
        
        // Only consider movies where both users have actually rated the movie
        // A null/undefined rating means they didn't want to rate it, not a 0-star rating
        if (userAMovie.rating !== null && userAMovie.rating !== undefined && 
            userBMovie.rating !== null && userBMovie.rating !== undefined) {
          console.log(`✅ Both users rated ${slug}: ${userAMovie.rating} vs ${userBMovie.rating}`);
          const disagreementScore = Math.abs(userAMovie.rating - userBMovie.rating);
          commonMovies.push({
            film_slug: slug,
            title: slug,
            year: 'N/A',
            poster_url: null,
            letterboxd_slug: slug,
            user_a_rating: userAMovie.rating,
            user_b_rating: userBMovie.rating,
            disagreement_score: disagreementScore,
            user_a_handle: userA,
            user_b_handle: userB
          });
        } else {
          console.log(`❌ Skipping ${slug} - one or both users missing rating`);
        }
      }
    }

    console.log(`Found ${commonMovies.length} movies where both users have ratings`);

    if (commonMovies.length === 0) {
      console.log('No common movies found between users');
      return null;
    }

    // Find the highest disagreement score
    const maxDisagreementScore = Math.max(...commonMovies.map(m => m.disagreement_score));
    console.log(`Highest disagreement score: ${maxDisagreementScore}`);

    // Filter to only movies with the highest disagreement score
    const highestDisagreementMovies = commonMovies.filter(m => m.disagreement_score === maxDisagreementScore);
    console.log(`Found ${highestDisagreementMovies.length} movies with disagreement score ${maxDisagreementScore}`);

    // Step 1: Check which movies have reviews by both users
    const bothHaveReviews = [];
    for (const movie of highestDisagreementMovies) {
      const userAHasReview = await checkIfUserHasReview(userA, movie.film_slug);
      const userBHasReview = await checkIfUserHasReview(userB, movie.film_slug);
      if (userAHasReview && userBHasReview) {
        bothHaveReviews.push(movie);
      }
    }
    
    // Step 2: If both have reviews, randomly select from that pool
    if (bothHaveReviews.length > 0) {
      console.log(`Found ${bothHaveReviews.length} movies where both users have reviews`);
      const selectedMovie = bothHaveReviews[Math.floor(Math.random() * bothHaveReviews.length)];
      
      // Fetch poster URL for the selected movie
      try {
        const { data: filmData, error } = await supabase
          .from('films')
          .select('poster_url')
          .eq('film_slug', selectedMovie.film_slug)
          .single();
        
        if (!error && filmData && filmData.poster_url) {
          selectedMovie.poster_url = filmData.poster_url;
          console.log(`Found poster for ${selectedMovie.film_slug}: ${filmData.poster_url}`);
        } else {
          console.log(`No poster found for ${selectedMovie.film_slug}`);
        }
      } catch (err) {
        console.log(`Error fetching poster for ${selectedMovie.film_slug}:`, err.message);
      }
      
      // Final validation: ensure we never return a movie with null ratings
      const finalMovie = await enrichMovieData(selectedMovie, true); // true = fetch reviews
      console.log(`Final movie before return (bothHaveReviews): ${finalMovie.film_slug}, userA rating: ${finalMovie.user_a_rating}, userB rating: ${finalMovie.user_b_rating}`);
      
      if (finalMovie.user_a_rating === null || finalMovie.user_a_rating === undefined || 
          finalMovie.user_b_rating === null || finalMovie.user_b_rating === undefined) {
        console.error(`❌ CRITICAL ERROR: Attempting to return movie with null ratings: ${finalMovie.film_slug}`);
        console.error(`User A rating: ${finalMovie.user_a_rating}, User B rating: ${finalMovie.user_b_rating}`);
        return null; // Don't return invalid data
      }
      
      return finalMovie;
    }

    // Step 3: Check which movies have reviews by at least one user
    const oneHasReview = [];
    for (const movie of highestDisagreementMovies) {
      const userAHasReview = await checkIfUserHasReview(userA, movie.film_slug);
      const userBHasReview = await checkIfUserHasReview(userB, movie.film_slug);
      if (userAHasReview || userBHasReview) {
        oneHasReview.push(movie);
      }
    }
    
    // Step 4: If one has review, randomly select from that pool
    if (oneHasReview.length > 0) {
      console.log(`Found ${oneHasReview.length} movies where at least one user has a review`);
      const selectedMovie = oneHasReview[Math.floor(Math.random() * oneHasReview.length)];
      
      // Fetch poster URL for the selected movie
      try {
        const { data: filmData, error } = await supabase
          .from('films')
          .select('poster_url')
          .eq('film_slug', selectedMovie.film_slug)
          .single();
        
        if (!error && filmData && filmData.poster_url) {
          selectedMovie.poster_url = filmData.poster_url;
          console.log(`Found poster for ${selectedMovie.film_slug}: ${filmData.poster_url}`);
        } else {
          console.log(`No poster found for ${selectedMovie.film_slug}`);
        }
      } catch (err) {
        console.log(`Error fetching poster for ${selectedMovie.film_slug}:`, err.message);
      }
      
      // Final validation: ensure we never return a movie with null ratings
      const finalMovie = await enrichMovieData(selectedMovie, true); // true = fetch reviews
      console.log(`Final movie before return (oneHasReview): ${finalMovie.film_slug}, userA rating: ${finalMovie.user_a_rating}, userB rating: ${finalMovie.user_b_rating}`);
      
      if (finalMovie.user_a_rating === null || finalMovie.user_a_rating === undefined || 
          finalMovie.user_b_rating === null || finalMovie.user_b_rating === undefined) {
        console.error(`❌ CRITICAL ERROR: Attempting to return movie with null ratings: ${finalMovie.film_slug}`);
        console.error(`User A rating: ${finalMovie.user_a_rating}, User B rating: ${finalMovie.user_b_rating}`);
        return null; // Don't return invalid data
      }
      
      return finalMovie;
    }

    // Step 5: Fallback to random selection from highest disagreement pool
    console.log('No reviews found, selecting random movie from highest disagreement pool');
    const selectedMovie = highestDisagreementMovies[Math.floor(Math.random() * highestDisagreementMovies.length)];
    
    // Fetch poster URL for the selected movie
    try {
      const { data: filmData, error } = await supabase
        .from('films')
        .select('poster_url')
        .eq('film_slug', selectedMovie.film_slug)
        .single();
      
      if (!error && filmData && filmData.poster_url) {
        selectedMovie.poster_url = filmData.poster_url;
        console.log(`No poster found for ${selectedMovie.film_slug}: ${filmData.poster_url}`);
      } else {
        console.log(`No poster found for ${selectedMovie.film_slug}`);
      }
    } catch (err) {
      console.log(`Error fetching poster for ${selectedMovie.film_slug}:`, err.message);
    }
    
    // Final validation: ensure we never return a movie with null ratings
    const finalMovie = await enrichMovieData(selectedMovie, true); // true = fetch reviews
    console.log(`Final movie before return: ${finalMovie.film_slug}, userA rating: ${finalMovie.user_a_rating}, userB rating: ${finalMovie.user_b_rating}`);
    
    if (finalMovie.user_a_rating === null || finalMovie.user_a_rating === undefined || 
        finalMovie.user_b_rating === null || finalMovie.user_b_rating === undefined) {
      console.error(`❌ CRITICAL ERROR: Attempting to return movie with null ratings: ${finalMovie.film_slug}`);
      console.error(`User A rating: ${finalMovie.user_a_rating}, User B rating: ${finalMovie.user_b_rating}`);
      return null; // Don't return invalid data
    }
    
    return finalMovie;

  } catch (error) {
    console.error('Error finding biggest disagreement movie:', error);
    return null;
  }
}

/**
 * Enrich movie data with poster URL, title, year, director, and optionally reviews
 * @param {Object} movie - Basic movie object
 * @param {boolean} fetchReviews - Whether to fetch review text
 * @returns {Promise<Object>} Enriched movie object
 */
async function enrichMovieData(movie, fetchReviews = false) {
  try {
    // Get film metadata from films table
    const { data: filmData, error } = await supabase
      .from('films')
      .select('poster_url, year, directors')
      .eq('film_slug', movie.film_slug)
      .single();

    if (error) {
      console.warn(`No film data found for ${movie.film_slug}:`, error.message);
    } else {
      movie.title = movie.film_slug; // Use the slug as title since film_title doesn't exist
      movie.year = filmData.year || 'N/A';
      movie.director = filmData.directors ? filmData.directors.join(', ') : 'Unknown';
      // Only set poster_url if we don't already have one
      if (!movie.poster_url && filmData.poster_url) {
        movie.poster_url = filmData.poster_url;
      }
    }

    // Optionally fetch review text for both users
    if (fetchReviews) {
      try {
        const [userAReview, userBReview] = await Promise.all([
          getReviewText(movie.user_a_handle, movie.film_slug),
          getReviewText(movie.user_b_handle, movie.film_slug)
        ]);
        
        movie.user_a_review = userAReview;
        movie.user_b_review = userBReview;
        
        console.log(`Reviews fetched: ${userAReview ? 'User A has review' : 'User A no review'}, ${userBReview ? 'User B has review' : 'User B no review'}`);
      } catch (reviewError) {
        console.warn('Error fetching reviews:', reviewError.message);
        movie.user_a_review = null;
        movie.user_b_review = null;
      }
    }

    return movie;
  } catch (error) {
    console.error('Error enriching movie data:', error);
    return movie;
  }
}

/**
 * Check if a user has written a review for a specific movie
 * Uses fast Axios + Cheerio first, falls back to Puppeteer if needed
 * @param {string} userHandle - User's Letterboxd handle
 * @param {string} filmSlug - Film's slug
 * @returns {Promise<boolean>} True if user has a review, false otherwise
 */
async function checkIfUserHasReview(userHandle, filmSlug) {
  try {
    const url = `https://letterboxd.com/${userHandle}/film/${filmSlug}/`;
    console.log(`Checking for review: ${url}`);
    
    // Try fast method first (Axios + Cheerio)
    try {
      const response = await axios.get(url, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      const $ = cheerio.load(response.data);
      
      // Check for review content using the selectors we identified
      const reviewContainer = $('section.review.js-review');
      const reviewBody = $('div.js-review-body');
      
      if (reviewContainer.length > 0 && reviewBody.length > 0) {
        // Check if there's actual review text (not just empty divs)
        const reviewText = reviewBody.find('p').text().trim();
        if (reviewText.length > 0) {
          console.log(`Found review for ${userHandle} on ${filmSlug} (fast method)`);
          return true;
        }
      }
      
      console.log(`No review found for ${userHandle} on ${filmSlug} (fast method)`);
      return false;
      
    } catch (fastError) {
      console.log(`Fast method failed for ${userHandle} on ${filmSlug}, trying Puppeteer:`, fastError.message);
      
      // Fallback to Puppeteer for JavaScript-rendered content
      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        // Block unnecessary resources for speed
        await page.setRequestInterception(true);
        page.on('request', (req) => {
          if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
            req.abort();
          } else {
            req.continue();
          }
        });
        
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 10000 });
        
        // Wait for review content to load
        await page.waitForSelector('section.review.js-review, .no-review', { timeout: 5000 });
        
        // Check if review exists
        const hasReview = await page.evaluate(() => {
          const reviewContainer = document.querySelector('section.review.js-review');
          const reviewBody = document.querySelector('div.js-review-body');
          
          if (reviewContainer && reviewBody) {
            const reviewText = reviewBody.querySelector('p')?.textContent?.trim();
            return reviewText && reviewText.length > 0;
          }
          return false;
        });
        
        console.log(`Puppeteer result for ${userHandle} on ${filmSlug}: ${hasReview ? 'Review found' : 'No review'}`);
        return hasReview;
        
      } finally {
        await browser.close();
      }
    }
    
  } catch (error) {
    console.error(`Error checking review for ${userHandle} on ${filmSlug}:`, error.message);
    return false; // Default to false on error
  }
}

/**
 * Get the actual review text for a user on a specific movie
 * @param {string} userHandle - User's Letterboxd handle
 * @param {string} filmSlug - Film's slug
 * @returns {Promise<string|null>} Review text or null if no review
 */
async function getReviewText(userHandle, filmSlug) {
  try {
    const url = `https://letterboxd.com/${userHandle}/film/${filmSlug}/`;
    
    // Try fast method first (Axios + Cheerio)
    try {
      const response = await axios.get(url, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      const $ = cheerio.load(response.data);
      
      // Check for review content using the selectors we identified
      const reviewContainer = $('section.review.js-review');
      const reviewBody = $('div.js-review-body');
      
      if (reviewContainer.length > 0 && reviewBody.length > 0) {
        // Get the actual review text
        const reviewText = reviewBody.find('p').text().trim();
        if (reviewText.length > 0) {
          return reviewText;
        }
      }
      
      return null;
      
    } catch (fastError) {
      console.log(`Fast method failed for review text on ${userHandle}/${filmSlug}, trying Puppeteer:`, fastError.message);
      
      // Fallback to Puppeteer for JavaScript-rendered content
      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        // Block unnecessary resources for speed
        await page.setRequestInterception(true);
        page.on('request', (req) => {
          if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
            req.abort();
          } else {
            req.continue();
          }
        });
        
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 10000 });
        
        // Wait for review content to load
        await page.waitForSelector('section.review.js-review, .no-review', { timeout: 5000 });
        
        // Get review text
        const reviewText = await page.evaluate(() => {
          const reviewContainer = document.querySelector('section.review.js-review');
          const reviewBody = document.querySelector('div.js-review-body');
          
          if (reviewContainer && reviewBody) {
            const reviewText = reviewBody.querySelector('p')?.textContent?.trim();
            return reviewText && reviewText.length > 0 ? reviewText : null;
          }
          return null;
        });
        
        return reviewText;
        
      } finally {
        await browser.close();
      }
    }
    
  } catch (error) {
    console.error(`Error getting review text for ${userHandle} on ${filmSlug}:`, error.message);
    return null;
  }
}

module.exports = { findCommonMovies, getCommonMoviesSummary, findBiggestDisagreementMovie };

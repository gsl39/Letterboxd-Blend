const supabase = require('./supabaseClient.cjs');

// Helper function to calculate average rating difference
function calculateAverageRatingDifference(userAFilms, userBFilms) {
  try {
    console.log('🔍 calculateAverageRatingDifference called with userAFilms length:', userAFilms.length, 'userBFilms length:', userBFilms.length);
    
    // Filter out films without ratings
    const userARated = userAFilms.filter(film => film.rating !== null);
    const userBRated = userBFilms.filter(film => film.rating !== null);
    
    console.log('🔍 After filtering - userARated:', userARated.length, 'userBRated:', userBRated.length);
    
    // Find common films
    const commonSlugs = new Set();
    userARated.forEach(film => {
      if (userBRated.some(bFilm => bFilm.film_slug === film.film_slug)) {
        commonSlugs.add(film.film_slug);
      }
    });
    
    console.log('🔍 Common slugs found:', commonSlugs.size);
    
    if (commonSlugs.size === 0) {
      console.log('🔍 No common films, returning 0');
      return 0.0;
    }
    
    // Calculate rating differences for common films
    let totalDifference = 0;
    let count = 0;
    
    userARated.forEach(film => {
      if (commonSlugs.has(film.film_slug)) {
        const bFilm = userBFilms.find(bFilm => bFilm.film_slug === film.film_slug);
        if (bFilm && bFilm.rating !== null) {
          totalDifference += Math.abs(film.rating - bFilm.rating);
          count++;
        }
      }
    });
    
    console.log('🔍 Final counts - totalDifference:', totalDifference, 'count:', count);
    
    if (count === 0) {
      console.log('🔍 No rated films in common, returning 0');
      return 0.0;
    }
    
    // Return average difference rounded to 1 decimal place
    const result = Math.round((totalDifference / count) * 10) / 10;
    console.log('🔍 Calculated average difference:', result);
    return result;
    
  } catch (error) {
    console.error('❌ Error in calculateAverageRatingDifference:', error);
    return 0.0;
  }
}

// Helper function to calculate percentage of same ratings
function calculateSameRatingPercentage(userAFilms, userBFilms) {
  try {
    console.log('🔍 calculateSameRatingPercentage called with userAFilms length:', userAFilms.length, 'userBFilms length:', userBFilms.length);
    
    // Filter out films without ratings
    const userARated = userAFilms.filter(film => film.rating !== null);
    const userBRated = userBFilms.filter(film => film.rating !== null);
    
    console.log('🔍 After filtering - userARated:', userARated.length, 'userBRated:', userBRated.length);
    
    // Find common films
    const commonSlugs = new Set();
    userARated.forEach(film => {
      if (userBRated.some(bFilm => bFilm.film_slug === film.film_slug)) {
        commonSlugs.add(film.film_slug);
      }
    });
    
    console.log('🔍 Common slugs found:', commonSlugs.size);
    
    if (commonSlugs.size === 0) {
      console.log('🔍 No common films, returning 0');
      return 0.0;
    }
    
    // Count movies with same ratings
    let sameRatingCount = 0;
    let totalRatedCount = 0;
    
    userARated.forEach(film => {
      if (commonSlugs.has(film.film_slug)) {
        const bFilm = userBFilms.find(bFilm => bFilm.film_slug === film.film_slug);
        if (bFilm && bFilm.rating !== null) {
          totalRatedCount++;
          if (film.rating === bFilm.rating) {
            sameRatingCount++;
          }
        }
      }
    });
    
    console.log('🔍 Final counts - sameRatingCount:', sameRatingCount, 'totalRatedCount:', totalRatedCount);
    
    if (totalRatedCount === 0) {
      console.log('🔍 No rated films in common, returning 0');
      return 0.0;
    }
    
    // Return percentage rounded to nearest whole number
    const percentage = Math.round((sameRatingCount / totalRatedCount) * 100);
    console.log('🔍 Final rounded percentage:', percentage);
    return percentage;
    
  } catch (error) {
    console.error('❌ Error in calculateSameRatingPercentage:', error);
    return 0.0;
  }
}

// Helper function to calculate rating alignment score
function ratingAlignmentScore(userAFilms, userBFilms) {
  // Filter out films without ratings
  const userARated = userAFilms.filter(film => film.rating !== null);
  const userBRated = userBFilms.filter(film => film.rating !== null);
  
  // Find common films
  const commonSlugs = new Set();
  userARated.forEach(film => {
    if (userBRated.some(bFilm => bFilm.film_slug === film.film_slug)) {
      commonSlugs.add(film.film_slug);
    }
  });
  
  if (commonSlugs.size === 0) return 0.0;
  
  // Get aligned ratings
  const ratingsA = [];
  const ratingsB = [];
  
  userARated.forEach(film => {
    if (commonSlugs.has(film.film_slug)) {
      const bFilm = userBFilms.find(bFilm => bFilm.film_slug === film.film_slug);
      if (bFilm && bFilm.rating !== null) {
        ratingsA.push(film.rating);
        ratingsB.push(bFilm.rating);
      }
    }
  });
  
  if (ratingsA.length === 0) return 0.0;
  
  // Agreement rate (within 0.5 stars)
  let agreementCount = 0;
  let totalDifference = 0;
  
  for (let i = 0; i < ratingsA.length; i++) {
    const diff = Math.abs(ratingsA[i] - ratingsB[i]);
    if (diff <= 0.5) agreementCount++;
    totalDifference += diff;
  }
  
  const agreementRate = agreementCount / ratingsA.length;
  const meanAbsoluteDifference = totalDifference / ratingsA.length;
  const madScaled = 1 - (meanAbsoluteDifference / 3);
  
  // Simple correlation approximation
  let correlation = 0;
  if (ratingsA.length > 1) {
    const meanA = ratingsA.reduce((a, b) => a + b, 0) / ratingsA.length;
    const meanB = ratingsB.reduce((a, b) => a + b, 0) / ratingsB.length;
    
    let numerator = 0;
    let denomA = 0;
    let denomB = 0;
    
    for (let i = 0; i < ratingsA.length; i++) {
      const diffA = ratingsA[i] - meanA;
      const diffB = ratingsB[i] - meanB;
      numerator += diffA * diffB;
      denomA += diffA * diffA;
      denomB += diffB * diffB;
    }
    
    if (denomA > 0 && denomB > 0) {
      correlation = numerator / Math.sqrt(denomA * denomB);
    }
  }
  
  const correlationScaled = (correlation + 1) / 2;
  
  // Final weighted score
  const score = (0.5 * agreementRate + 0.3 * madScaled + 0.2 * correlationScaled);
  return Math.round(score * 50 * 100) / 100; // out of 50, rounded to 2 decimal places
}

// Helper function to calculate relative overlap score
function relativeOverlapScore(userAFilms, userBFilms) {
  const filmsA = new Set(userAFilms.map(film => film.film_slug));
  const filmsB = new Set(userBFilms.map(film => film.film_slug));
  
  if (filmsA.size === 0 || filmsB.size === 0) return 0.0;
  
  const mutual = new Set([...filmsA].filter(x => filmsB.has(x)));
  const minSize = Math.min(filmsA.size, filmsB.size);
  
  if (minSize === 0) return 0.0;
  
  const rawOverlap = mutual.size / minSize;
  const softened = Math.pow(rawOverlap, 0.7);
  
  return Math.round(softened * 10 * 100) / 100; // out of 10
}

// Helper function to calculate thematic overlap score
function thematicOverlapScore(userAFilms, userBFilms) {
  const genresA = new Set();
  const genresB = new Set();
  
  userAFilms.forEach(film => {
    if (film.genres && Array.isArray(film.genres)) {
      film.genres.forEach(genre => genresA.add(genre));
    }
  });
  
  userBFilms.forEach(film => {
    if (film.genres && Array.isArray(film.genres)) {
      film.genres.forEach(genre => genresB.add(genre));
    }
  });
  
  if (genresA.size === 0 || genresB.size === 0) return 0.0;
  
  const mutual = new Set([...genresA].filter(x => genresB.has(x)));
  const total = new Set([...genresA, ...genresB]);
  
  const overlapRatio = mutual.size / total.size;
  return Math.round(overlapRatio * 10 * 100) / 100; // out of 10
}

// Helper function to calculate obscurity alignment score
function obscurityAlignmentScore(userAFilms, userBFilms, bins = 12) {
  const popularityA = userAFilms
    .filter(film => film.popularity !== null)
    .map(film => Math.log1p(film.popularity));
  
  const popularityB = userBFilms
    .filter(film => film.popularity !== null)
    .map(film => Math.log1p(film.popularity));
  
  if (popularityA.length === 0 || popularityB.length === 0) return 0.0;
  
  // Simple histogram comparison
  const allPopularity = [...popularityA, ...popularityB];
  const minPop = Math.min(...allPopularity);
  const maxPop = Math.max(...allPopularity);
  const binSize = (maxPop - minPop) / bins;
  
  if (binSize === 0) return 0.0;
  
  const histA = new Array(bins).fill(0);
  const histB = new Array(bins).fill(0);
  
  popularityA.forEach(pop => {
    const binIndex = Math.min(Math.floor((pop - minPop) / binSize), bins - 1);
    histA[binIndex]++;
  });
  
  popularityB.forEach(pop => {
    const binIndex = Math.min(Math.floor((pop - minPop) / binSize), bins - 1);
    histB[binIndex]++;
  });
  
  // Convert to percentages
  const totalA = histA.reduce((a, b) => a + b, 0);
  const totalB = histB.reduce((a, b) => a + b, 0);
  
  if (totalA === 0 || totalB === 0) return 0.0;
  
  const histAPercent = histA.map(count => (count / totalA) * 100);
  const histBPercent = histB.map(count => (count / totalB) * 100);
  
  // Manhattan distance
  let manhattanDistance = 0;
  for (let i = 0; i < bins; i++) {
    manhattanDistance += Math.abs(histAPercent[i] - histBPercent[i]);
  }
  
  const score = (1 - (manhattanDistance / 200)) * 10; // scale to 0-10
  return Math.round(score * 100) / 100;
}

// Helper function to calculate director overlap score
function directorOverlapScore(userAFilms, userBFilms, minCount = 3) {
  const directorCountsA = new Map();
  const directorCountsB = new Map();
  
  userAFilms.forEach(film => {
    if (film.directors && Array.isArray(film.directors)) {
      film.directors.forEach(director => {
        const name = director.trim();
        directorCountsA.set(name, (directorCountsA.get(name) || 0) + 1);
      });
    }
  });
  
  userBFilms.forEach(film => {
    if (film.directors && Array.isArray(film.directors)) {
      film.directors.forEach(director => {
        const name = director.trim();
        directorCountsB.set(name, (directorCountsB.get(name) || 0) + 1);
      });
    }
  });
  
  const directorsA = new Set([...directorCountsA.entries()]
    .filter(([_, count]) => count >= minCount)
    .map(([name, _]) => name));
  
  const directorsB = new Set([...directorCountsB.entries()]
    .filter(([_, count]) => count >= minCount)
    .map(([name, _]) => name));
  
  if (directorsA.size === 0 || directorsB.size === 0) return 0.0;
  
  const mutual = new Set([...directorsA].filter(x => directorsB.has(x)));
  
  const coverageA = mutual.size / directorsA.size;
  const coverageB = mutual.size / directorsB.size;
  
  const avgCoverage = (coverageA + coverageB) / 2;
  const softened = Math.pow(avgCoverage, 0.5);
  
  return Math.round(softened * 10 * 100) / 100; // out of 10
}

// Helper function to calculate diversity bonus
function diversityBonus(userAFilms, userBFilms, maxGenres = 20) {
  const mutualSlugs = new Set();
  userAFilms.forEach(film => {
    if (userBFilms.some(bFilm => bFilm.film_slug === film.film_slug)) {
      mutualSlugs.add(film.film_slug);
    }
  });
  
  if (mutualSlugs.size === 0) return 0.0;
  
  const genres = new Set();
  
  userAFilms.forEach(film => {
    if (mutualSlugs.has(film.film_slug) && film.genres && Array.isArray(film.genres)) {
      film.genres.forEach(genre => genres.add(genre.trim()));
    }
  });
  
  userBFilms.forEach(film => {
    if (mutualSlugs.has(film.film_slug) && film.genres && Array.isArray(film.genres)) {
      film.genres.forEach(genre => genres.add(genre.trim()));
    }
  });
  
  const diversityRatio = Math.min(genres.size, maxGenres) / maxGenres;
  return Math.round(diversityRatio * 10 * 100) / 100; // out of 10
}

// Helper function to calculate average popularity for a user
function calculateAveragePopularity(userFilms) {
  const filmsWithPopularity = userFilms.filter(film => film.popularity !== null);
  if (filmsWithPopularity.length === 0) return null;
  
  const totalPopularity = filmsWithPopularity.reduce((sum, film) => sum + film.popularity, 0);
  return Math.round((totalPopularity / filmsWithPopularity.length) * 100) / 100;
}

// Helper function to calculate favorite common genres with weighted ratings
function calculateFavoriteCommonGenres(userAFilms, userBFilms, topCount = 3) {
  console.log('Debug: userAFilms sample:', userAFilms.slice(0, 2));
  console.log('Debug: userBFilms sample:', userBFilms.slice(0, 2));
  
  const genreStats = new Map();
  
  // Process user A films
  userAFilms.forEach(film => {
    if (film.rating !== null && film.genres && Array.isArray(film.genres)) {
      film.genres.forEach(genre => {
        const genreName = genre.trim();
        if (!genreStats.has(genreName)) {
          genreStats.set(genreName, { totalRating: 0, count: 0, films: [] });
        }
        const stats = genreStats.get(genreName);
        stats.totalRating += film.rating;
        stats.count += 1;
        stats.films.push({ slug: film.film_slug, rating: film.rating });
      });
    }
  });
  
  // Process user B films
  userBFilms.forEach(film => {
    if (film.rating !== null && film.genres && Array.isArray(film.genres)) {
      film.genres.forEach(genre => {
        const genreName = genre.trim();
        if (!genreStats.has(genreName)) {
          genreStats.set(genreName, { totalRating: 0, count: 0, films: [] });
        }
        const stats = genreStats.get(genreName);
        stats.totalRating += film.rating;
        stats.count += 1;
        stats.films.push({ slug: film.film_slug, rating: film.rating });
      });
    }
  });
  
  console.log('Debug: genreStats keys:', Array.from(genreStats.keys()));
  
  // Calculate weighted averages and find common genres
  const commonGenres = [];
  
  genreStats.forEach((stats, genreName) => {
    if (stats.count >= 2) { // At least 2 films to be considered
      const weightedRating = stats.totalRating / stats.count;
      const weight = Math.min(stats.count, 5); // Cap weight at 5 for balance
      const finalScore = weightedRating * weight;
      
      commonGenres.push({
        name: genreName,
        averageRating: Math.round(weightedRating * 10) / 10,
        filmCount: stats.count,
        weightedScore: Math.round(finalScore * 10) / 10
      });
    }
  });
  
  console.log('Debug: commonGenres found:', commonGenres);
  
  // Sort by weighted score and return top results
  return commonGenres
    .sort((a, b) => b.weightedScore - a.weightedScore)
    .slice(0, topCount);
}

// Helper function to calculate favorite common directors with weighted ratings
function calculateFavoriteCommonDirectors(userAFilms, userBFilms, topCount = 3) {
  console.log('Debug: Checking directors in films...');
  
  const directorStats = new Map();
  
  // Process user A films
  userAFilms.forEach(film => {
    if (film.rating !== null && film.directors && Array.isArray(film.directors)) {
      film.directors.forEach(director => {
        const directorName = director.trim();
        if (!directorStats.has(directorName)) {
          directorStats.set(directorName, { totalRating: 0, count: 0, films: [] });
        }
        const stats = directorStats.get(directorName);
        stats.totalRating += film.rating;
        stats.count += 1;
        stats.films.push({ slug: film.film_slug, rating: film.rating });
      });
    }
  });
  
  // Process user B films
  userBFilms.forEach(film => {
    if (film.rating !== null && film.directors && Array.isArray(film.directors)) {
      film.directors.forEach(director => {
        const directorName = director.trim();
        if (!directorStats.has(directorName)) {
          directorStats.set(directorName, { totalRating: 0, count: 0, films: [] });
        }
        const stats = directorStats.get(directorName);
        stats.totalRating += film.rating;
        stats.count += 1;
        stats.films.push({ slug: film.film_slug, rating: film.rating });
      });
    }
  });
  
  console.log('Debug: directorStats keys:', Array.from(directorStats.keys()));
  
  // Calculate weighted averages and find common directors
  const commonDirectors = [];
  
  directorStats.forEach((stats, directorName) => {
    if (stats.count >= 2) { // At least 2 films to be considered
      const weightedRating = stats.totalRating / stats.count;
      const weight = Math.min(stats.count, 5); // Cap weight at 5 for balance
      const finalScore = weightedRating * weight;
      
      commonDirectors.push({
        name: directorName,
        averageRating: Math.round(weightedRating * 10) / 10,
        filmCount: stats.count,
        weightedScore: Math.round(finalScore * 10) / 10
      });
    }
  });
  
  console.log('Debug: commonDirectors found:', commonDirectors);
  
  // Sort by weighted score and return top results
  return commonDirectors
    .sort((a, b) => b.weightedScore - a.weightedScore)
    .slice(0, topCount);
}

// Main function to calculate complete compatibility score
function calculateCompatibilityScore(userAFilms, userBFilms) {
  const rating = ratingAlignmentScore(userAFilms, userBFilms);
  const overlap = relativeOverlapScore(userAFilms, userBFilms);
  const theme = thematicOverlapScore(userAFilms, userBFilms);
  const obscurity = obscurityAlignmentScore(userAFilms, userBFilms);
  const directors = directorOverlapScore(userAFilms, userBFilms);
  const diversity = diversityBonus(userAFilms, userBFilms);
  
  const totalScore = rating + overlap + theme + obscurity + directors + diversity;
  
  return {
    scores: {
      rating_alignment: rating,
      relative_overlap: overlap,
      thematic_overlap: theme,
      obscurity_alignment: obscurity,
      director_overlap: directors,
      diversity_bonus: diversity
    },
    total_score: Math.round(totalScore * 100) / 100,
    stats: {
      films_user_a: userAFilms.length,
      films_user_b: userBFilms.length,
      common_films: new Set([...userAFilms.map(f => f.film_slug)].filter(slug => 
        userBFilms.some(bFilm => bFilm.film_slug === slug)
      )).size
    }
  };
}

// Function to get user films data from Supabase using batch processing
async function getUserFilmsData(userHandle) {
  try {
    let allMovies = [];
    let offset = 0;
    const batchSize = 1000;
    let data; // Declare data variable outside the loop scope
    
    console.log(`🔍 Fetching movies for ${userHandle} in batches of ${batchSize}...`);
    
    do {
      const result = await supabase
        .from('user_films_with_films')
        .select('*')
        .eq('user_handle', userHandle)
        .range(offset, offset + batchSize - 1);
      
      data = result.data; // Assign to outer variable
      const { error } = result;
      
      if (error) {
        console.error(`Error fetching batch for ${userHandle} at offset ${offset}:`, error);
        break;
      }
      
      if (data && data.length > 0) {
        allMovies = allMovies.concat(data);
        console.log(`📦 Fetched batch: ${data.length} movies (total so far: ${allMovies.length})`);
      }
      
      offset += batchSize;
    } while (data && data.length === batchSize);
    
    console.log(`✅ Total movies fetched for ${userHandle}: ${allMovies.length}`);
    return allMovies;
  } catch (err) {
    console.error(`Error fetching data for user ${userHandle}:`, err);
    return [];
  }
}

// Function to get common films data and calculate favorite genres/directors
async function getCommonFilmsStats(userA, userB) {
  console.log('=== getCommonFilmsStats START ===');
  console.log('Debug [NEW]: getCommonFilmsStats called with:', userA, userB);
  try {
    console.log('Debug [NEW]: Starting to fetch user films...');
    
    // Get all films for both users using batch processing
    console.log('🔍 Fetching films for userA:', userA);
    const userAFilms = await getUserFilmsData(userA);
    
    console.log('🔍 Fetching films for userB:', userB);
    const userBFilms = await getUserFilmsData(userB);
    
    console.log('📊 Fetched films - userA:', userAFilms?.length, 'userB:', userBFilms?.length);
    
    // Debug: Show the actual structure of what we got
    if (userAFilms && userAFilms.length > 0) {
      console.log('🔍 Sample userA film structure:', {
        film_slug: userAFilms[0].film_slug,
        rating: userAFilms[0].rating,
        genres: userAFilms[0].genres,
        directors: userAFilms[0].directors,
        all_keys: Object.keys(userAFilms[0])
      });
    }
    
    if (userBFilms && userBFilms.length > 0) {
      console.log('🔍 Sample userB film structure:', {
        film_slug: userBFilms[0].film_slug,
        rating: userBFilms[0].rating,
        genres: userBFilms[0].genres,
        directors: userBFilms[0].directors,
        all_keys: Object.keys(userBFilms[0])
      });
    }
    
    if (!userAFilms || !userBFilms || userAFilms.length === 0 || userBFilms.length === 0) {
      console.error('Error: One or both users have no films');
      return { favorite_genres: [], favorite_directors: [] };
    }
    
    // Find common films by film_slug
    const userAFilmSlugs = new Set(userAFilms.map(f => f.film_slug));
    const commonFilms = userBFilms.filter(film => userAFilmSlugs.has(film.film_slug));
    
    console.log('Debug: Found', commonFilms.length, 'common films');
    
    // Debug: Check a few common films to see their structure
    if (commonFilms.length > 0) {
      console.log('Debug [NEW]: Sample common film structure:', {
        film_slug: commonFilms[0].film_slug,
        rating: commonFilms[0].rating,
        genres: commonFilms[0].genres,
        directors: commonFilms[0].directors,
        has_genres: !!commonFilms[0].genres,
        has_directors: !!commonFilms[0].directors,
        genres_type: typeof commonFilms[0].genres,
        directors_type: typeof commonFilms[0].directors
      });
    }
    
    // Calculate favorite genres from common films
    const genreStats = new Map();
    commonFilms.forEach(film => {
      if (film.rating !== null && film.genres && Array.isArray(film.genres)) {
        film.genres.forEach(genre => {
          const genreName = genre.trim();
          if (!genreStats.has(genreName)) {
            genreStats.set(genreName, { totalRating: 0, count: 0 });
          }
          const stats = genreStats.get(genreName);
          stats.totalRating += film.rating;
          stats.count += 1;
        });
      }
    });
    
    // Calculate favorite directors from common films
    const directorStats = new Map();
    commonFilms.forEach(film => {
      if (film.rating !== null && film.directors && Array.isArray(film.directors)) {
        film.directors.forEach(director => {
          const directorName = director.trim();
          if (!directorStats.has(directorName)) {
            directorStats.set(directorName, { totalRating: 0, count: 0 });
          }
          const stats = directorStats.get(directorName);
          stats.totalRating += film.rating;
          stats.count += 1;
        });
      }
    });
    
    console.log('Debug [NEW]: genreStats keys:', Array.from(genreStats.keys()));
    console.log('Debug [NEW]: directorStats keys:', Array.from(directorStats.keys()));
    
    // Convert to arrays and sort by weighted score
    const favoriteGenres = Array.from(genreStats.entries())
      .map(([name, stats]) => ({
        name,
        averageRating: Math.round((stats.totalRating / stats.count) * 10) / 10,
        filmCount: stats.count,
        weightedScore: Math.round((stats.totalRating / stats.count) * Math.min(stats.count, 5) * 10) / 10
      }))
      .sort((a, b) => b.weightedScore - a.weightedScore)
      .slice(0, 3);
    
    const favoriteDirectors = Array.from(directorStats.entries())
      .map(([name, stats]) => ({
        name,
        averageRating: Math.round((stats.totalRating / stats.count) * 10) / 10,
        filmCount: stats.count,
        weightedScore: Math.round((stats.totalRating / stats.count) * Math.min(stats.count, 5) * 10) / 10
      }))
      .sort((a, b) => b.weightedScore - a.weightedScore)
      .slice(0, 3);
    
    console.log('Debug [NEW]: favoriteGenres found:', favoriteGenres);
    console.log('Debug [NEW]: favoriteDirectors found:', favoriteDirectors);
    
    // Calculate average rating difference between users for common films
    const averageRatingDifference = calculateAverageRatingDifference(userAFilms, userBFilms);
    console.log('Debug [NEW]: Average rating difference:', averageRatingDifference);
    
    // Calculate percentage of same ratings
    console.log('Debug [NEW]: About to call calculateSameRatingPercentage...');
    const sameRatingPercentage = calculateSameRatingPercentage(userAFilms, userBFilms);
    console.log('Debug [NEW]: Same rating percentage:', sameRatingPercentage);
    
    return { 
      favorite_genres: favoriteGenres, 
      favorite_directors: favoriteDirectors,
      average_rating_difference: averageRatingDifference,
      same_rating_percentage: sameRatingPercentage
    };
    
  } catch (err) {
    console.error('Error getting common films stats:', err);
    return { favorite_genres: [], favorite_directors: [] };
  }
}

// Main function to calculate compatibility between two users
async function getCompatibilityScore(userA, userB) {
  try {
    console.log('🔍 Starting compatibility calculation for:', userA, 'vs', userB);
    
    const userAFilms = await getUserFilmsData(userA);
    const userBFilms = await getUserFilmsData(userB);
    
    if (userAFilms.length === 0 || userBFilms.length === 0) {
      return {
        error: "One or both users not found or have no films",
        user_a: userA,
        user_b: userB
      };
    }
    
    console.log('📊 Films loaded - userA:', userAFilms.length, 'userB:', userBFilms.length);
    
    // Check if ALL movies have metadata before proceeding
    const userAMissingMetadata = userAFilms.filter(film => 
      !film.genres || !film.directors || film.popularity === null
    );
    const userBMissingMetadata = userBFilms.filter(film => 
      !film.genres || !film.directors || film.popularity === null
    );
    
    console.log('🔍 Metadata check - userA missing:', userAMissingMetadata.length, 'userB missing:', userBMissingMetadata.length);
    
    if (userAMissingMetadata.length > 0 || userBMissingMetadata.length > 0) {
      console.log('❌ Some movies missing metadata - cannot calculate compatibility yet');
      console.log('❌ UserA missing metadata for:', userAMissingMetadata.map(f => f.film_slug).slice(0, 5));
      console.log('❌ UserB missing metadata for:', userBMissingMetadata.map(f => f.film_slug).slice(0, 5));
      
      return {
        error: "Some movies are missing metadata. Please wait for metadata scraping to complete.",
        user_a: userA,
        user_b: userB,
        metadata_status: {
          user_a_missing: userAMissingMetadata.length,
          user_b_missing: userBMissingMetadata.length,
          total_missing: userAMissingMetadata.length + userBMissingMetadata.length
        }
      };
    }
    
    console.log('✅ All movies have metadata - proceeding with compatibility calculation');
    
    const result = calculateCompatibilityScore(userAFilms, userBFilms);
    
    // Calculate average popularity for each user
    const userAAvgPopularity = calculateAveragePopularity(userAFilms);
    const userBAvgPopularity = calculateAveragePopularity(userBFilms);
    
    // Get favorite genres and directors from common films
    const commonFilmsStats = await getCommonFilmsStats(userA, userB);
    
    // Add the genre and director data to the existing stats object
    result.stats.favorite_genres = commonFilmsStats.favorite_genres;
    result.stats.favorite_directors = commonFilmsStats.favorite_directors;
    result.stats.average_rating_difference = commonFilmsStats.average_rating_difference;
    result.stats.same_rating_percentage = commonFilmsStats.same_rating_percentage;
    
    return {
      user_a: userA,
      user_b: userB,
      ...result,
      popularity_data: {
        user_a_average: userAAvgPopularity,
        user_b_average: userBAvgPopularity
      }
    };
    
  } catch (err) {
    console.error(`Error calculating compatibility score:`, err);
    return {
      error: err.message,
      user_a: userA,
      user_b: userB
    };
  }
}

// Function to check metadata readiness for compatibility calculation
async function checkMetadataReadiness(userA, userB, lockData) {
  try {
    const userAFilms = await getUserFilmsData(userA);
    const userBFilms = await getUserFilmsData(userB);
    
    if (userAFilms.length === 0 || userBFilms.length === 0) {
      return {
        ready: false,
        error: "One or both users not found or have no films",
        user_a: userA,
        user_b: userB
      };
    }
    
    // Get expected counts from scraping locks (if available)
    let expectedUserACount = null;
    let expectedUserBCount = null;
    
    // Define buffer outside the if block so it's accessible everywhere
    const buffer = 10;
    
    if (lockData) {
      expectedUserACount = lockData.user_a_count;
      expectedUserBCount = lockData.user_b_count;
      
      console.log(`🔍 Expected counts - User A: ${expectedUserACount}, User B: ${expectedUserBCount}`);
      console.log(`🔍 Actual counts - User A: ${userAFilms.length}, User B: ${userBFilms.length}`);
      
      // Verify scraping completeness with ±10 buffer for robustness
      let userAComplete = false;
      let userBComplete = false;
      
      if (expectedUserACount && Math.abs(userAFilms.length - expectedUserACount) > buffer) {
        return {
          ready: false,
          error: `User A scraping incomplete: expected ${expectedUserACount} ±${buffer}, got ${userAFilms.length}`,
          user_a: userA,
          user_b: userB,
          scraping_verification: {
            user_a_expected: expectedUserACount,
            user_a_actual: userAFilms.length,
            user_a_complete: false
          }
        };
      } else if (expectedUserACount) {
        // User A count is within buffer - mark as complete
        userAComplete = true;
        console.log(`✅ User A scraping verified: expected ${expectedUserACount} ±${buffer}, got ${userAFilms.length}`);
      }
      
      if (expectedUserBCount && Math.abs(userBFilms.length - expectedUserBCount) > buffer) {
        return {
          ready: false,
          error: `User B scraping incomplete: expected ${expectedUserBCount} ±${buffer}, got ${userBFilms.length}`,
          user_a: userA,
          user_b: userB,
          scraping_verification: {
            user_b_expected: expectedUserBCount,
            user_b_actual: userBFilms.length,
            user_b_complete: false
          }
        };
      } else if (expectedUserBCount) {
        // User B count is within buffer - mark as complete
        userBComplete = true;
        console.log(`✅ User B scraping verified: expected ${expectedUserBCount} ±${buffer}, got ${userBFilms.length}`);
      }
    }
    
    const userAMissingMetadata = userAFilms.filter(film => 
      !film.genres || !film.directors || film.popularity === null
    );
    const userBMissingMetadata = userBFilms.filter(film => 
      !film.genres || !film.directors || film.popularity === null
    );
    
    const totalMissing = userAMissingMetadata.length + userBMissingMetadata.length;
    const ready = totalMissing === 0;
    
    return {
      ready,
      user_a: userA,
      user_b: userB,
      metadata_status: {
        user_a_total: userAFilms.length,
        user_b_total: userBFilms.length,
        user_a_missing: userAMissingMetadata.length,
        user_b_missing: userBMissingMetadata.length,
        total_missing: totalMissing,
        missing_films: {
          user_a: userAMissingMetadata.map(f => f.film_slug).slice(0, 10),
          user_b: userBMissingMetadata.map(f => f.film_slug).slice(0, 10)
        }
      },
      scraping_verification: {
        user_a_expected: expectedUserACount,
        user_a_actual: userAFilms.length,
        user_a_complete: userAComplete,
        user_b_expected: expectedUserBCount,
        user_b_actual: userBFilms.length,
        user_b_complete: userBComplete
      }
    };
  } catch (err) {
    console.error('Error checking metadata readiness:', err);
    return {
      ready: false,
      error: err.message,
      user_a: userA,
      user_b: userB
    };
  }
}

module.exports = {
  getCompatibilityScore,
  calculateCompatibilityScore,
  ratingAlignmentScore,
  relativeOverlapScore,
  thematicOverlapScore,
  obscurityAlignmentScore,
  directorOverlapScore,
  diversityBonus,
  calculateAveragePopularity,
  calculateFavoriteCommonGenres,
  calculateFavoriteCommonDirectors,
  getCommonFilmsStats,
  checkMetadataReadiness
};
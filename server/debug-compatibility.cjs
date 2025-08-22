const { 
  getCompatibilityScore, 
  calculateCompatibilityScore,
  ratingAlignmentScore,
  relativeOverlapScore,
  thematicOverlapScore,
  obscurityAlignmentScore,
  directorOverlapScore,
  diversityBonus
} = require('./compatibility.cjs');

async function debugCompatibility() {
  console.log('🔍 Debugging compatibility functions...\n');
  
  // Test the specific pair that had the biggest difference
  const userA = 'aaviva_c';
  const userB = 'iokkeichen';
  
  console.log(`📊 Debugging: ${userA} vs ${userB}\n`);
  
  try {
    // Get the raw data first
    const { getUserFilmsData } = require('./compatibility.cjs');
    
    // We need to access the internal function - let me recreate it here
    const supabase = require('./supabaseClient.cjs');
    
    const { data: userAFilms } = await supabase
      .from('user_films_with_films')
      .select('*')
      .eq('user_handle', userA);
    
    const { data: userBFilms } = await supabase
      .from('user_films_with_films')
      .select('*')
      .eq('user_handle', userB);
    
    if (!userAFilms || !userBFilms) {
      console.log('❌ Could not fetch user data');
      return;
    }
    
    console.log(`📊 User A (${userA}): ${userAFilms.length} films`);
    console.log(`📊 User B (${userB}): ${userBFilms.length} films`);
    
    // Test each function individually
    console.log('\n🧮 Testing individual functions:');
    console.log('=' .repeat(50));
    
    const rating = ratingAlignmentScore(userAFilms, userBFilms);
    console.log(`📈 Rating Alignment: ${rating}/50`);
    
    const overlap = relativeOverlapScore(userAFilms, userBFilms);
    console.log(`🎬 Relative Overlap: ${overlap}/10`);
    
    const theme = thematicOverlapScore(userAFilms, userBFilms);
    console.log(`🎭 Thematic Overlap: ${theme}/10`);
    
    const obscurity = obscurityAlignmentScore(userAFilms, userBFilms);
    console.log(`🌟 Obscurity Alignment: ${obscurity}/10`);
    
    const directors = directorOverlapScore(userAFilms, userBFilms);
    console.log(`🎬 Director Overlap: ${directors}/10`);
    
    const diversity = diversityBonus(userAFilms, userBFilms);
    console.log(`🌈 Diversity Bonus: ${diversity}/10`);
    
    const total = rating + overlap + theme + obscurity + directors + diversity;
    console.log('=' .repeat(50));
    console.log(`🏆 Total Score: ${total}/100`);
    
    // Show detailed breakdown for rating alignment (most complex function)
    console.log('\n🔍 Detailed Rating Alignment Breakdown:');
    console.log('=' .repeat(50));
    
    // Filter out films without ratings
    const userARated = userAFilms.filter(film => film.rating !== null);
    const userBRated = userBFilms.filter(film => film.rating !== null);
    
    console.log(`📊 User A rated films: ${userARated.length}`);
    console.log(`📊 User B rated films: ${userBRated.length}`);
    
    // Find common films
    const commonSlugs = new Set();
    userARated.forEach(film => {
      if (userBRated.some(bFilm => bFilm.film_slug === film.film_slug)) {
        commonSlugs.add(film.film_slug);
      }
    });
    
    console.log(`🎯 Common rated films: ${commonSlugs.size}`);
    
    if (commonSlugs.size > 0) {
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
      
      console.log(`📊 Aligned rating pairs: ${ratingsA.length}`);
      
      if (ratingsA.length > 0) {
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
        
        console.log(`✅ Agreement rate (within 0.5 stars): ${(agreementRate * 100).toFixed(2)}%`);
        console.log(`📏 Mean absolute difference: ${meanAbsoluteDifference.toFixed(3)}`);
        console.log(`📊 MAD scaled: ${madScaled.toFixed(3)}`);
        
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
        
        console.log(`📈 Correlation: ${correlation.toFixed(3)}`);
        console.log(`📊 Correlation scaled: ${correlationScaled.toFixed(3)}`);
        
        // Final weighted score
        const score = (0.5 * agreementRate + 0.3 * madScaled + 0.2 * correlationScaled);
        const finalScore = Math.round(score * 50 * 100) / 100;
        
        console.log(`🧮 Raw score: ${score.toFixed(3)}`);
        console.log(`🏆 Final rating score: ${finalScore}/50`);
      }
    }
    
  } catch (err) {
    console.error(`💥 Exception: ${err.message}`);
    console.error(err.stack);
  }
}

// Run the debug
debugCompatibility().catch(console.error);

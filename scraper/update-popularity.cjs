// Load environment variables from parent directory
require('dotenv').config({ path: '../.env' });
const supabase = require('../server/supabaseClient.cjs');
const { getFilmMetadataFromLetterboxd } = require('./letterboxdScraper.cjs');

async function updateExistingMoviesWithPopularity() {
  console.log('🎬 Starting popularity update for existing movies...\n');
  
  try {
    // Fetch all existing movies from Supabase
    const { data: movies, error } = await supabase
      .from('films')
      .select('film_slug, popularity')
      .order('film_slug');
    
    if (error) {
      console.error('❌ Error fetching movies:', error);
      return;
    }
    
    console.log(`📊 Found ${movies.length} movies in database`);
    console.log(`📈 Movies without popularity: ${movies.filter(m => m.popularity === null).length}\n`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    // Process movies in batches to avoid overwhelming the server
    const batchSize = 5;
    for (let i = 0; i < movies.length; i += batchSize) {
      const batch = movies.slice(i, i + batchSize);
      
      console.log(`\n🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(movies.length/batchSize)}`);
      
      for (const movie of batch) {
        // Skip if already has popularity data
        if (movie.popularity !== null) {
          console.log(`  ⏭️  Skipping "${movie.film_slug}" (already has popularity: ${movie.popularity})`);
          continue;
        }
        
        try {
          // Get updated metadata including popularity
          const updatedMetadata = await getFilmMetadataFromLetterboxd(movie.film_slug);
          
          if (updatedMetadata && updatedMetadata.popularity) {
            // Update the movie in Supabase
            const { error: updateError } = await supabase
              .from('films')
              .update({ popularity: updatedMetadata.popularity })
              .eq('film_slug', movie.film_slug);
            
            if (updateError) {
              console.error(`    ❌ Error updating "${movie.film_slug}":`, updateError.message);
              errorCount++;
            } else {
              console.log(`    ✅ Updated "${movie.film_slug}" with popularity: ${updatedMetadata.popularity}`);
              updatedCount++;
            }
          } else {
            console.log(`    ⚠️  No popularity data found for "${movie.film_slug}"`);
            errorCount++;
          }
          
          // Wait between requests to be respectful
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          console.error(`    ❌ Error processing "${movie.film_slug}":`, error.message);
          errorCount++;
        }
      }
      
      // Wait between batches
      if (i + batchSize < movies.length) {
        console.log('  ⏳ Waiting 5 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    console.log(`\n🏁 Update complete!`);
    console.log(`✅ Successfully updated: ${updatedCount} movies`);
    console.log(`❌ Errors: ${errorCount} movies`);
    console.log(`📊 Total processed: ${movies.length} movies`);
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
  }
}

// Run the update
updateExistingMoviesWithPopularity().catch(console.error); 
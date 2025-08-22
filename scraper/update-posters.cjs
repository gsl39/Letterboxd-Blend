const puppeteer = require('puppeteer');
require('dotenv').config({ path: '../.env' });
const supabase = require('../server/supabaseClient.cjs');

async function scrapePosterUrl(page, filmSlug) {
  try {
    // Navigate to the film page with faster loading
    const filmUrl = `https://letterboxd.com/film/${filmSlug}/`;
    console.log(`Scraping poster for: ${filmSlug}`);
    
    await page.goto(filmUrl, { 
      waitUntil: 'domcontentloaded', // Faster than 'networkidle2'
      timeout: 15000 // Reduced from 30000
    });
    
    // Wait for the poster with shorter timeout
    await page.waitForSelector('.react-component.poster img', { timeout: 8000 });
    
    // Extract the poster URL
    const posterUrl = await page.evaluate(() => {
      const posterElement = document.querySelector('.react-component.poster img');
      return posterElement ? posterElement.src : null;
    });
    
    if (posterUrl) {
      console.log(`✅ Found poster for ${filmSlug}`);
      return posterUrl;
    } else {
      console.log(`❌ No poster found for ${filmSlug}`);
      return null;
    }
    
  } catch (error) {
    console.error(`Error scraping ${filmSlug}:`, error.message);
    return null;
  }
}

async function processFilmBatch(browser, films, startIndex, batchSize) {
  const batch = films.slice(startIndex, startIndex + batchSize);
  const promises = batch.map(async (film) => {
    const page = await browser.newPage();
    
    // Optimize page performance
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      // Block unnecessary resources for faster loading
      if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    // Set user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    try {
      const posterUrl = await scrapePosterUrl(page, film.film_slug);
      
      if (posterUrl) {
        // Update the film record with the poster URL
        const { error: updateError } = await supabase
          .from('films')
          .update({ poster_url: posterUrl })
          .eq('film_slug', film.film_slug);
        
        if (updateError) {
          console.error(`Error updating ${film.film_slug}:`, updateError);
          return { success: false, film: film.film_slug, error: 'Database update failed' };
        } else {
          return { success: true, film: film.film_slug, posterUrl };
        }
      } else {
        return { success: false, film: film.film_slug, error: 'No poster found' };
      }
      
    } finally {
      await page.close(); // Close page, not browser
    }
  });
  
  return Promise.all(promises);
}

async function updatePosters() {
  let browser;
  try {
    console.log('🚀 Starting optimized poster update process...');
    
    // Launch browser once and reuse
    browser = await puppeteer.launch({ 
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    
    // Get all films that don't have poster URLs yet
    const { data: films, error } = await supabase
      .from('films')
      .select('film_slug, poster_url')
      .is('poster_url', null);
    
    if (error) {
      console.error('Error fetching films:', error);
      return;
    }
    
    console.log(`📽️ Found ${films.length} films without poster URLs`);
    
    // Process films in parallel batches
    const batchSize = 8; // Process 8 films simultaneously
    const totalBatches = Math.ceil(films.length / batchSize);
    
    let updatedCount = 0;
    let errorCount = 0;
    const startTime = Date.now();
    
    for (let i = 0; i < films.length; i += batchSize) {
      const batchNumber = Math.floor(i / batchSize) + 1;
      console.log(`\n🔄 Processing batch ${batchNumber}/${totalBatches} (films ${i + 1}-${Math.min(i + batchSize, films.length)})`);
      
      const results = await processFilmBatch(browser, films, i, batchSize);
      
      // Process results
      results.forEach(result => {
        if (result.success) {
          updatedCount++;
        } else {
          errorCount++;
          console.log(`❌ ${result.film}: ${result.error}`);
        }
      });
      
      // Progress update
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const remaining = films.length - (i + batchSize);
      const estimatedTime = remaining > 0 ? ((elapsed / (i + batchSize)) * remaining).toFixed(1) : 0;
      
      console.log(`📊 Progress: ${Math.min(i + batchSize, films.length)}/${films.length} | ✅ ${updatedCount} | ❌ ${errorCount} | ⏱️ ${elapsed}s | 🕐 ~${estimatedTime}s remaining`);
      
      // Small delay between batches to be respectful
      if (i + batchSize < films.length) {
        await new Promise(resolve => setTimeout(resolve, 500)); // Reduced from 1000ms
      }
    }
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n🎬 Poster update complete!`);
    console.log(`✅ Successfully updated: ${updatedCount} films`);
    console.log(`❌ Errors: ${errorCount} films`);
    console.log(`⏱️ Total time: ${totalTime}s`);
    console.log(`🚀 Average speed: ${(updatedCount / totalTime).toFixed(2)} films/second`);
    
  } catch (error) {
    console.error('Fatal error in updatePosters:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the update if this file is executed directly
if (require.main === module) {
  updatePosters().then(() => {
    console.log('Poster update script finished');
    process.exit(0);
  }).catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = { updatePosters, scrapePosterUrl };

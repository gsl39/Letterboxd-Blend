console.log('letterboxdScraper.cjs loaded');

const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

async function getWatchedMovies(username, page = 1) {
    try {
        const url = `https://letterboxd.com/${username}/films/page/${page}/`;
        const { data } = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
          },
          timeout: 30000,
        });
        const $ = cheerio.load(data);

        // Each film is in a griditem (new Letterboxd structure)
        const movies = [];
        $('.griditem').each((i, el) => {
            const poster = $(el).find('.film-poster');
            const filmTitle = poster.find('img').attr('alt');
            const filmSlug = $(el).find('[data-item-slug]').attr('data-item-slug');

            const ratingClass = $(el).find('.poster-viewingdata .rating').attr('class') || '';
            const ratingMatch = ratingClass.match(/rated-(\d+)/);
            const rating = ratingMatch ? parseInt(ratingMatch[1], 10) / 2 : null;

            const liked = $(el).find('.like.liked-micro').length > 0;

            if (filmSlug && filmTitle) {
                movies.push({ title: filmTitle, slug: filmSlug, rating, liked});
            }
        });

        console.log($('.griditem').length, 'grid items found');

        // Check if there is a next page (new Letterboxd structure)
        const nextPageSelector = `.paginate-pages a[href$="/page/${page + 1}/"]`;
        const hasNext = $(nextPageSelector).length > 0;

        return { movies, hasNext };
    
    } 
    catch (error) {
        console.error(`Error scraping movies for ${username} page ${page}:`, error);
        return { movies: [], hasNext: false };
    }
}

async function getAllWatchedMovies(username) {
  let allMovies = [];
  let page = 1;
  let hasNext = true;
  while (hasNext) {
    const { movies, hasNext: next } = await getWatchedMovies(username, page);
    allMovies = allMovies.concat(movies);
    hasNext = next;
    page++;
    if (hasNext) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return allMovies;
}

async function getFilmMetadataFromLetterboxd(slug) {
  const url = `https://letterboxd.com/film/${slug}/`;
  console.log(`🔍 Starting metadata scrape for: ${slug} at ${url}`);
  
  try {
    // Get basic metadata with axios/cheerio (faster for static content)
    console.log(`📡 Fetching HTML for ${slug}...`);
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 15000, // Reduced from 30000 for faster failure detection
    });
    
    if (!data) {
      console.error(`❌ No HTML data received for ${slug}`);
      return null;
    }
    
    console.log(`✅ HTML received for ${slug}, length: ${data.length}`);
    const $ = cheerio.load(data);

    // Year
    let year = null;
    const yearText = $('.releasedate a').first().text().trim();
    if (yearText && /^\d{4}$/.test(yearText)) {
      year = parseInt(yearText, 10);
    }
    console.log(`📅 Year for ${slug}: ${year} (raw: "${yearText}")`);

    // Poster URL
    let poster_url = null;
    const posterImg = $('.film-poster img').attr('src') ||
                      $('.poster-list img').attr('src') ||
                      $('img.image').attr('src');
    if (posterImg) {
      poster_url = posterImg.startsWith('//') ? 'https:' + posterImg : posterImg;
    }
    console.log(`🖼️ Poster URL for ${slug}: ${poster_url}`);

    // Genres
    const genres = [];
    $('a[href^="/films/genre/"]').each((i, el) => {
      genres.push($(el).text().trim());
    });
    console.log(`🎭 Genres for ${slug}: ${genres.length} found - ${genres.join(', ')}`);

    // Directors
    const directors = [];
    $('.credits .creatorlist a.contributor .prettify').each((i, el) => {
      directors.push($(el).text().trim());
    });
    console.log(`🎬 Directors for ${slug}: ${directors.length} found - ${directors.join(', ')}`);

    // Get popularity with Puppeteer (for JavaScript-rendered content)
    let popularity = null;
    console.log(`📊 Starting popularity scrape for ${slug}...`);
    try {
      const browser = await puppeteer.launch({ 
        headless: true,
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage', // Moderate optimization
          '--no-first-run', // Moderate optimization
          '--disable-gpu', // Render.com compatibility
          '--disable-software-rasterizer', // Render.com compatibility
          '--disable-extensions', // Render.com compatibility
          '--single-process', // Render.com compatibility
          '--no-zygote' // Render.com compatibility
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined, // Use system Chrome if available
        ignoreDefaultArgs: ['--disable-extensions'] // Allow extensions for better compatibility
      });
      
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Moderate optimization: faster page loading
      console.log(`🌐 Loading page for ${slug}...`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      
      // Wait for the production statistics to load
      console.log(`⏳ Waiting for popularity data for ${slug}...`);
      await page.waitForSelector('.production-statistic.-watches', { timeout: 8000 }); // Reduced from 10000
      
      // Extract the popularity data
      const popularityData = await page.evaluate(() => {
        const watchesElement = document.querySelector('.production-statistic.-watches');
        if (watchesElement) {
          return watchesElement.getAttribute('aria-label');
        }
        return null;
      });
      
      console.log(`📊 Raw popularity data for ${slug}: "${popularityData}"`);
      
      // Parse the popularity number
      if (popularityData) {
        const popularityMatch = popularityData.match(/Watched by ([\d,]+)/);
        if (popularityMatch) {
          popularity = parseInt(popularityMatch[1].replace(/,/g, ''), 10);
          console.log(`✅ Parsed popularity for ${slug}: ${popularity}`);
        } else {
          console.log(`❌ Could not parse popularity for ${slug}: "${popularityData}"`);
        }
      } else {
        console.log(`❌ No popularity data found for ${slug}`);
      }
      
      await browser.close();
      console.log(`🔒 Browser closed for ${slug}`);
    } catch (puppeteerError) {
      console.error(`❌ Error getting popularity for ${slug}:`, puppeteerError.message);
      console.error(`❌ Full puppeteer error for ${slug}:`, puppeteerError);
      
      // Try alternative method: use system Chrome if available
      try {
        console.log(`🔄 Trying alternative Chrome path for ${slug}...`);
        const browser = await puppeteer.launch({ 
          headless: true,
          args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--single-process'
          ],
          executablePath: '/usr/bin/google-chrome' // Common system Chrome path
        });
        
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        console.log(`🌐 Alternative: Loading page for ${slug}...`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        
        await page.waitForSelector('.production-statistic.-watches', { timeout: 8000 });
        
        const popularityData = await page.evaluate(() => {
          const watchesElement = document.querySelector('.production-statistic.-watches');
          if (watchesElement) {
            return watchesElement.getAttribute('aria-label');
          }
          return null;
        });
        
        if (popularityData) {
          const popularityMatch = popularityData.match(/Watched by ([\d,]+)/);
          if (popularityMatch) {
            popularity = parseInt(popularityMatch[1].replace(/,/g, ''), 10);
            console.log(`✅ Alternative method success for ${slug}: ${popularity}`);
          }
        }
        
        await browser.close();
      } catch (fallbackError) {
        console.log(`❌ Alternative method also failed for ${slug}:`, fallbackError.message);
        // Continue without popularity data
      }
    }

    const result = {
      film_slug: slug,
      year,
      poster_url: poster_url || '',
      genres: genres.length ? genres : null,
      directors: directors.length ? directors : null,
      popularity: popularity || 0 // Default to 0 if popularity scraping fails
    };
    
    console.log(`🎯 Final metadata result for ${slug}:`, result);
    return result;
  } catch (err) {
    console.error(`Error scraping metadata for film slug '${slug}':`, err.message);
    return null;
  }
}

// Moderate optimization: batch processing for a few films at once
async function getFilmMetadataBatch(slugs, batchSize = 3) {
  const results = [];
  
  for (let i = 0; i < slugs.length; i += batchSize) {
    const batch = slugs.slice(i, i + batchSize);
    const batchPromises = batch.map(slug => getFilmMetadataFromLetterboxd(slug));
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults.filter(result => result !== null));
    
    // Small delay between batches to be respectful
    if (i + batchSize < slugs.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return results;
}

module.exports = { getAllWatchedMovies, getWatchedMovies, getFilmMetadataFromLetterboxd, getFilmMetadataBatch };

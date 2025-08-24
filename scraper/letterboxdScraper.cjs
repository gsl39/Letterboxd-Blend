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
  
  try {
    // Get basic metadata with axios/cheerio (faster for static content)
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
    const $ = cheerio.load(data);

    // Year
    let year = null;
    const yearText = $('.releasedate a').first().text().trim();
    if (yearText && /^\d{4}$/.test(yearText)) {
      year = parseInt(yearText, 10);
    }

    // Poster URL
    let poster_url = null;
    const posterImg = $('.film-poster img').attr('src') ||
                      $('.poster-list img').attr('src') ||
                      $('img.image').attr('src');
    if (posterImg) {
      poster_url = posterImg.startsWith('//') ? 'https:' + posterImg : posterImg;
    }

    // Genres
    const genres = [];
    $('a[href^="/films/genre/"]').each((i, el) => {
      genres.push($(el).text().trim());
    });

    // Directors
    const directors = [];
    $('.credits .creatorlist a.contributor .prettify').each((i, el) => {
      directors.push($(el).text().trim());
    });

    // Get popularity with Puppeteer (for JavaScript-rendered content)
    let popularity = null;
    try {
      const browser = await puppeteer.launch({ 
        headless: true,
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage', // Moderate optimization
          '--no-first-run' // Moderate optimization
        ]
      });
      
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Moderate optimization: faster page loading
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      
      // Wait for the production statistics to load
      await page.waitForSelector('.production-statistic.-watches', { timeout: 8000 }); // Reduced from 10000
      
      // Extract the popularity data
      const popularityData = await page.evaluate(() => {
        const watchesElement = document.querySelector('.production-statistic.-watches');
        if (watchesElement) {
          return watchesElement.getAttribute('aria-label');
        }
        return null;
      });
      
              // Parse the popularity number
        if (popularityData) {
          const popularityMatch = popularityData.match(/Watched by ([\d,]+)/);
          if (popularityMatch) {
            popularity = parseInt(popularityMatch[1].replace(/,/g, ''), 10);
          }
        }
      
      await browser.close();
    } catch (puppeteerError) {
      console.error(`Error getting popularity for ${slug}:`, puppeteerError.message);
      // Continue without popularity data
    }

    return {
      film_slug: slug,
      film_title: $('h1.film-title').text().trim() || slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      year,
      poster_url: poster_url || '',
      genres: genres.length ? genres : null,
      directors: directors.length ? directors : null,
      popularity
    };
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

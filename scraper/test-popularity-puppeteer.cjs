const puppeteer = require('puppeteer');

// Test with some popular films
const testFilms = [
  'the-shawshank-redemption',
  'the-godfather',
  'pulp-fiction',
  'the-dark-knight',
  'inception'
];

async function debugPopularityWithPuppeteer(filmSlug) {
  console.log(`\n🧪 Testing with Puppeteer: ${filmSlug}`);
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set user agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    const url = `https://letterboxd.com/film/${filmSlug}/`;
    console.log(`  Loading: ${url}`);
    
    // Navigate to the page
    await page.goto(url, { waitUntil: 'networkidle2' });
    
    // Wait for the production statistics to load
    console.log(`  Waiting for statistics to load...`);
    await page.waitForSelector('.production-statistic.-watches', { timeout: 10000 });
    
    // Extract the popularity data
    const popularityData = await page.evaluate(() => {
      const watchesElement = document.querySelector('.production-statistic.-watches');
      if (watchesElement) {
        const ariaLabel = watchesElement.getAttribute('aria-label');
        console.log('Found aria-label:', ariaLabel);
        return ariaLabel;
      }
      return null;
    });
    
    console.log(`  aria-label: "${popularityData}"`);
    
    // Extract the number
    const popularity = popularityData?.match(/Watched by ([\d,]+)/)?.[1]?.replace(/,/g, '') ?? null;
    const popularityNumber = popularity ? parseInt(popularity, 10) : null;
    
    console.log(`  Extracted popularity: ${popularityNumber}`);
    
    // Take a screenshot for debugging (optional)
    // await page.screenshot({ path: `debug-${filmSlug}.png` });
    
    return { popularityNumber, popularityData };
    
  } catch (error) {
    console.error(`  ❌ Error: ${error.message}`);
    return null;
  } finally {
    await browser.close();
  }
}

async function runPuppeteerTests() {
  console.log('🎬 Testing Letterboxd Popularity Scraper with Puppeteer\n');
  
  for (const filmSlug of testFilms) {
    const result = await debugPopularityWithPuppeteer(filmSlug);
    console.log('─'.repeat(50));
    
    // Wait a bit between requests to be respectful
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n🏁 All Puppeteer tests completed!');
}

// Run the tests
runPuppeteerTests().catch(console.error); 
const { findBiggestDisagreementMovie } = require('./server/commonMovies.cjs');

async function testDisagreement() {
  try {
    console.log('Testing biggest disagreement movie function...');
    
    const result = await findBiggestDisagreementMovie('guigui08', 'aaviva_C');
    
    if (result) {
      console.log('\n🎬 Biggest Disagreement Movie:');
      console.log(`Title: ${result.film_slug}`);
      console.log(`${result.user_a_handle}: ${result.user_a_rating}★`);
      console.log(`${result.user_b_handle}: ${result.user_b_rating}★`);
      console.log(`Disagreement Score: ${result.disagreement_score}`);
      console.log(`Poster URL: ${result.poster_url || 'None'}`);
    } else {
      console.log('No disagreement movie found');
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testDisagreement();

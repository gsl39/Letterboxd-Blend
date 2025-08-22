const { getCompatibilityScore } = require('./compatibility.cjs');

async function testCompatibility() {
  console.log('🧪 Testing compatibility functions...\n');
  
  // Test with your existing users
  const testUsers = ['aaviva_c', 'guigui08', 'iokkeichen'];
  
  for (let i = 0; i < testUsers.length; i++) {
    for (let j = i + 1; j < testUsers.length; j++) {
      const userA = testUsers[i];
      const userB = testUsers[j];
      
      console.log(`📊 Testing: ${userA} vs ${userB}`);
      console.log('⏳ Calculating...');
      
      try {
        const result = await getCompatibilityScore(userA, userB);
        
        if (result.error) {
          console.log(`❌ Error: ${result.error}\n`);
        } else {
          console.log(`✅ Total Score: ${result.total_score}/100`);
          console.log(`   📈 Rating Alignment: ${result.scores.rating_alignment}/50`);
          console.log(`   🎬 Relative Overlap: ${result.scores.relative_overlap}/10`);
          console.log(`   🎭 Thematic Overlap: ${result.scores.thematic_overlap}/10`);
          console.log(`   🌟 Obscurity Alignment: ${result.scores.obscurity_alignment}/10`);
          console.log(`   🎬 Director Overlap: ${result.scores.director_overlap}/10`);
          console.log(`   🌈 Diversity Bonus: ${result.scores.diversity_bonus}/10`);
          console.log(`   📊 Stats: ${result.stats.films_user_a} films vs ${result.stats.films_user_b} films (${result.stats.common_films} common)\n`);
        }
      } catch (err) {
        console.log(`💥 Exception: ${err.message}\n`);
      }
    }
  }
  
  console.log('🏁 Testing complete!');
}

// Run the test
testCompatibility().catch(console.error);

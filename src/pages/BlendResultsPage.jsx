import { useParams } from "react-router-dom";
import { useEffect, useState, useRef, useCallback } from "react";
import BackgroundGlow from "../components/BackgroundGlow";
import { supabase } from "../supabaseClient";
import { BACKEND_URL } from "../config";



export default function BlendResultsPage() {
  const { blendId } = useParams();
  const [handles, setHandles] = useState({ user_a: null, user_b: null });
  const [compatibility, setCompatibility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [allDataLoaded, setAllDataLoaded] = useState(false);
  const [scoreRevealed, setScoreRevealed] = useState(false);
  const [scoreAnimationComplete, setScoreAnimationComplete] = useState(false);
  const [taglineAnimationStart, setTaglineAnimationStart] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);
  const [showSubtext, setShowSubtext] = useState(false);
  const [commonMovies, setCommonMovies] = useState([]);
  const [disagreementMovie, setDisagreementMovie] = useState(null);
  const [arrowVisible, setArrowVisible] = useState(true);
  const animationRef = useRef(null);

  // Helper functions
  const getScoreTier = useCallback((score) => {
    if (score >= 85) return 'premium';
    if (score >= 70) return 'strong';
    if (score >= 50) return 'moderate';
    return 'low';
  }, []);

  const getScoreColor = useCallback((score) => {
    return 'text-black';
  }, []);

  // Helper function to get progress ring color based on current progress
  const getProgressColor = useCallback((progress) => {
    if (progress <= 33) return '#22c55e'; // Green for 0-33%
    if (progress <= 66) return '#3b82f6'; // Blue for 33-66%
    return '#f97316'; // Orange for 66-100%
  }, []);

  // Helper function to get tagline based on score
  const getTagline = useCallback((score) => {
    if (score <= 20) return "There Will Be Blood. And disagreement.";
    if (score <= 40) return "No Country for Shared Taste.";
    if (score <= 60) return "“You either die a hero or live long enough to see your friend log Grown Ups 2 again.”";
    if (score <= 80) return "“We’re gonna need a bigger watchlist.”";
    if (score < 95) return "You two are like Matt Damon & Ben Affleck"
    if (score >= 95) return "Shot. Reverse shot. Forever.";
    return "";
  }, []);

  // Helper function to get disagreement header based on disagreement score
  const getDisagreementHeader = useCallback((disagreementScore, movieTitle) => {
    if (disagreementScore === 4.5) return "You Gave This Five Stars??";
    if (disagreementScore >= 3) return "I'm Gonna Pretend You Didn't Say That.";
    return `We Need to Talk About ${movieTitle.replace(/\b\w/g, l => l.toUpperCase())}...`;
  }, []);

  // Helper function to get obscurity description based on score
  const getObscurityDescription = useCallback((obscurityScore, userAPopularity, userBPopularity) => {
    console.log('🔍 getObscurityDescription called with:', { obscurityScore, userAPopularity, userBPopularity });
    
    if (obscurityScore >= 8) {
      if (userAPopularity > 1500000 && userBPopularity > 1500000) {
        console.log('✅ High obscurity + both blockbuster bros');
        return "You're both certified blockbuster bros. Your idea of 'indie cinema' is probably 'The Dark Knight.'";
      } else {
        console.log('✅ High obscurity + arthouse scene');
        return "You're both deep in the arthouse scene. You both drove 18 hours to watch The Brutalist in 70mm";
      }
    }
    
    if (obscurityScore >= 6) {
      if (userAPopularity > 1500000 && userBPopularity > 1500000) {
        console.log('✅ Medium obscurity + both blockbuster bros - MCU tagline');
        return "Sometimes you're in sync,\nsometimes you're arguing over which MCU Phase deserves popcorn.";
      } else if (userAPopularity > 1500000 && userBPopularity > 1500000) {
        console.log('✅ Medium obscurity + both mainstream');
        return "You both know your way around a multiplex,\nbut one of you has a secret Criterion subscription.";
      } else {
        console.log('✅ Medium obscurity + mixed scene');
        return "You nod at each other across the festival line,\nthen disappear into different theaters.";
      }
    }
    
    if (obscurityScore >= 4) {
      if (userAPopularity > 1000000 && userBPopularity > 1000000) {
        console.log('✅ Low obscurity + both mainstream');
        return "You're both mainstream moviegoers. Sometimes you discover the same hidden gem,\nother times one of you is watching 'Barbie' while the other is watching 'Perfect Blue.'";
      } else {
        console.log('✅ Low obscurity + mixed tastes');
        return "You're moderately aligned. Sometimes you both discover the same hidden gem,\nother times one of you is watching 'Barbie' while the other is watching 'Perfect Blue.'";
      }
    }
    
    // Low alignment (0-4)
    if (Math.random() > 0.5) {
      console.log('✅ Very low obscurity - option 1');
      return "One of you lives in the Criterion closet,\nthe other in line for the new Star Wars.";
    } else {
      console.log('✅ Very low obscurity - option 2');
      return "One of you is Cannes, the other is Comic-Con.";
    }
  }, []);

  const getTierGradient = useCallback((score) => {
    const tier = getScoreTier(score);
    switch (tier) {
      case 'premium': return 'from-purple-500/20 via-pink-500/20 to-purple-600/20';
      case 'strong': return 'from-emerald-500/20 via-green-500/20 to-teal-500/20';
      case 'moderate': return 'from-yellow-500/20 via-orange-500/20 to-amber-500/20';
      case 'low': return 'from-red-500/20 via-pink-500/20 to-red-600/20';
      default: return 'from-gray-500/20 to-gray-600/20';
    }
  }, [getScoreTier]);

  const getTierSubtext = useCallback((score) => {
    const tier = getScoreTier(score);
    switch (tier) {
      case 'premium': return 'Cinematic soulmates';
      case 'strong': return 'Strong compatibility';
      case 'moderate': return 'Some overlap, some surprises';
      case 'low': return 'Quite different tastes';
      default: return '';
    }
  }, [getScoreTier]);

  const animateScore = useCallback((finalScore) => {
    const duration = 2000; // 2 seconds for smooth integer animation
    const startTime = Date.now();
    const startScore = 0;
    const targetScore = Math.round(finalScore); // Round to nearest integer
    
    const updateScore = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      if (progress < 1) {
        // Smooth ease-out animation for integers
        const easeOut = 1 - Math.pow(1 - progress, 2);
        const currentScore = Math.floor(startScore + (targetScore - startScore) * easeOut);
        setDisplayScore(currentScore);
        
        animationRef.current = requestAnimationFrame(updateScore);
      } else {
        setDisplayScore(targetScore);
        setScoreAnimationComplete(true);
        // Start tagline animation after score is complete
        setTimeout(() => {
          setTaglineAnimationStart(true);
        }, 300);
      }
    };
    
    updateScore();
  }, []);

  // Helper function to display star ratings with half stars
  const formatStarRating = useCallback((rating) => {
    if (rating === null || rating === undefined) return '';
    
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    
    let stars = '★'.repeat(fullStars);
    if (hasHalfStar) {
      stars += '½';
    }
    
    return stars;
  }, []);

  // Fetch handles
  useEffect(() => {
    async function fetchHandles() {
      setLoading(true);
      const { data } = await supabase
        .from("blends")
        .select("user_a, user_b")
        .eq("blend_id", blendId)
        .single();
      
      if (data) {
        setHandles({ user_a: data.user_a, user_b: data.user_b });
      }
      
      setLoading(false);
    }
    fetchHandles();
  }, [blendId]);

  // Handle scraping for user_b if needed (runs after handles are loaded)
  const [scrapingComplete, setScrapingComplete] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [hasStartedScraping, setHasStartedScraping] = useState(false);
  
  useEffect(() => {
    if (!handles.user_b || hasStartedScraping) return;
    
    async function checkAndScrapeIfNeeded() {
      // Check if user_b already has movies in the database
      const { data: userBMovies } = await supabase
        .from('user_films_with_films')
        .select('film_slug')
        .eq('user_handle', handles.user_b)
        .limit(1);
      
      // If no movies found, start scraping
      if (!userBMovies || userBMovies.length === 0) {
        console.log('Starting scraping for user_b:', handles.user_b);
        setHasStartedScraping(true);
        setIsScraping(true);
        try {
          await fetch(`${BACKEND_URL}/api/scrape`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              handle: handles.user_b, 
              blend_id: blendId, 
              user: 'b' 
            }),
          });
          console.log('Scraping completed for user_b:', handles.user_b);
          setIsScraping(false);
          setScrapingComplete(true);
        } catch (error) {
          console.error('Scraping failed:', error);
          setIsScraping(false);
          setScrapingComplete(true); // Mark as complete even if failed
        }
      } else {
        // User already has movies, mark scraping as complete
        setScrapingComplete(true);
      }
    }
    
    checkAndScrapeIfNeeded();
  }, [handles.user_b, blendId, hasStartedScraping]);

  // Fetch compatibility
  useEffect(() => {
    async function fetchCompatibility() {
      if (!handles.user_a || !handles.user_b || !scrapingComplete) return;
      
      console.log('Fetching compatibility for:', handles.user_a, 'vs', handles.user_b);
      setCalculating(true);
      
      try {
        const response = await fetch(`${BACKEND_URL}/api/compatibility`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_a: handles.user_a,
            user_b: handles.user_b
          })
        });
        
        console.log('Response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('Compatibility data received:', data);
          setCompatibility(data);
          // Don't trigger animation here - wait for all data to load
        } else {
          const errorText = await response.text();
          console.error('Failed to fetch compatibility:', response.status, errorText);
        }
      } catch (error) {
        console.error('Error fetching compatibility:', error);
      }
      // Don't set calculating to false here - wait for all data to load
    }

    fetchCompatibility();
  }, [handles.user_a, handles.user_b, scrapingComplete]);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Fetch common movies
  useEffect(() => {
    if (handles.user_a && handles.user_b && scrapingComplete) {
      console.log('Fetching common movies between:', handles.user_a, 'and', handles.user_b);
      
      let commonMoviesLoaded = false;
      let disagreementMovieLoaded = false;
      
      const checkAllDataLoaded = () => {
        console.log('🔍 checkAllDataLoaded called:', { commonMoviesLoaded, disagreementMovieLoaded });
        if (commonMoviesLoaded && disagreementMovieLoaded) {
          console.log('✅ All data loaded, setting allDataLoaded=true and calculating=false');
          setAllDataLoaded(true);
          setCalculating(false);
        }
      };
      
              fetch(`${BACKEND_URL}/api/common-movies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_a: handles.user_a,
          user_b: handles.user_b,
          max_movies: 4
        })
      })
      .then(response => response.json())
      .then(data => {
        console.log('Common movies from backend:', data);
        setCommonMovies(data.movies || []);
        commonMoviesLoaded = true;
        checkAllDataLoaded();
      })
      .catch(error => {
        console.error('Error fetching common movies:', error);
        setCommonMovies([]);
        commonMoviesLoaded = true;
        checkAllDataLoaded();
      });

      // Fetch biggest disagreement movie
              fetch(`${BACKEND_URL}/api/biggest-disagreement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_a: handles.user_a,
          user_b: handles.user_b
        })
      })
      .then(response => response.json())
      .then(data => {
        console.log('Disagreement movie from backend:', data);
        setDisagreementMovie(data.movie || null);
        disagreementMovieLoaded = true;
        checkAllDataLoaded();
      })
      .catch(error => {
        console.error('Error fetching disagreement movie:', error);
        setDisagreementMovie(null);
        disagreementMovieLoaded = true;
        checkAllDataLoaded();
      });
    }
  }, [handles.user_a, handles.user_b, scrapingComplete]);

  // Reset animation states when all data is loaded
  useEffect(() => {
    console.log('🔍 Score reveal useEffect:', { allDataLoaded, hasCompatibility: !!compatibility });
    if (allDataLoaded && compatibility) {
      console.log('✅ Starting score reveal animation');
      // Start the complete animation sequence
      setTimeout(() => {
        setScoreRevealed(true);
        animateScore(compatibility.total_score);
      }, 500);
    }
  }, [allDataLoaded, compatibility]);

  // Hide arrow after first scroll
  useEffect(() => {
    const handleScroll = () => {
      if (arrowVisible && window.scrollY > 50) {
        setArrowVisible(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [arrowVisible]);





  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className={`${taglineAnimationStart ? 'min-h-[420vh]' : 'h-screen'} flex flex-col items-center p-4 font-manrope pt-16 ${!scoreAnimationComplete ? 'overflow-hidden' : ''}`}>

      
        <div className="fixed inset-0 -z-10">
        <BackgroundGlow isScoreRevealed={scoreAnimationComplete} />
      </div>
      
              {/* Show title and usernames only after all data is loaded */}
      {allDataLoaded && (
        <>
          <h1 className="text-5xl mb-17 font-manrope">Your Blend Results</h1>
          
          <div className="text-3xl font-bold mb-20">
            <a href={`https://letterboxd.com/${handles.user_a}/`} target="_blank" rel="noopener noreferrer" className="inline-block">
              <span className="font-['Space_Grotesk'] text-black px-6 py-3 rounded-2xl hover:scale-125 hover:rotate-2 transition-all duration-500 drop-shadow-[0_0_20px_rgba(251,146,60,0.4)] hover:drop-shadow-[0_0_30px_rgba(251,146,60,0.6)] drop-shadow-[0_4px_8px_rgba(0,0,0,0.2)] drop-shadow-[0_8px_16px_rgba(0,0,0,0.15)] relative z-10 bg-gradient-to-r from-orange-400 via-white-500 to-cyan-400 border-4 border-black shadow-[0_0_0_4px_rgba(0,0,0,0.15)] hover:shadow-[0_0_0_4px_rgba(255,255,255,0.3)] animate-gradient-x cursor-pointer">{handles.user_a}</span>
            </a>
            <span className="mx-8 text-gray-400 text-2xl relative z-10">×</span>
            <a href={`https://letterboxd.com/${handles.user_b}/`} target="_blank" rel="noopener noreferrer" className="inline-block">
              <span className="font-['Space_Grotesk'] text-black px-6 py-3 rounded-2xl hover:scale-125 hover:-rotate-2 transition-all duration-500 drop-shadow-[0_0_20px_rgba(34,211,238,0.4)] hover:drop-shadow-[0_0_30px_rgba(34,211,238,0.6)] drop-shadow-[0_4px_8px_rgba(0,0,0,0.2)] drop-shadow-[0_8px_16px_rgba(0,0,0,0.15)] relative z-10 bg-gradient-to-r from-cyan-400 via-emerald-300 to-emerald-400 border-4 border-black shadow-[0_0_0_4px_rgba(0,0,0,0.15)] hover:shadow-[0_0_0_4px_rgba(255,255,255,0.3)] animate-gradient-x cursor-pointer">{handles.user_b}</span>
            </a>
          </div>
        </>
      )}

      {(() => {
        const shouldShowLoading = (calculating || isScraping) && !allDataLoaded;
        console.log('🔍 Loading condition:', { calculating, isScraping, allDataLoaded, shouldShowLoading });
        return shouldShowLoading;
      })() && (
        <div className="w-full max-w-4xl text-center">
          {/* Elegant loading animation */}
          <div className="relative inline-block">
            <svg className="w-96 h-96 animate-spin" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="45"
                stroke="#e5e7eb"
                strokeWidth="3"
                fill="none"
                className="opacity-30"
              />
              {/* Loading circle - same logic as score ring but fully filled and rotating */}
              <circle
                cx="50"
                cy="50"
                r="45"
                stroke="url(#loadingGradient)"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                style={{
                  strokeDasharray: `${2 * Math.PI * 45}`,
                  strokeDashoffset: `${2 * Math.PI * 45 * (1 - 1)}`
                }}
              />
              {/* Loading gradient definition */}
              <defs>
                <linearGradient id="loadingGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f97316" />
                  <stop offset="50%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#00e054" />
                </linearGradient>
              </defs>
            </svg>
            
            {/* Loading text overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-2xl font-manrope text-gray-600 animate-pulse">
                {isScraping ? 'Scraping movies from Letterboxd...' : 'Calculating your cinematic compatibility...'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Animated score display */}
      {(() => {
        const shouldShowScore = compatibility && !compatibility.error && scoreRevealed && compatibility.total_score !== undefined && allDataLoaded;
        console.log('🔍 Score display condition:', { 
          hasCompatibility: !!compatibility, 
          noError: !compatibility?.error, 
          scoreRevealed, 
          hasTotalScore: compatibility?.total_score !== undefined, 
          allDataLoaded, 
          shouldShowScore 
        });
        return shouldShowScore;
      })() && (
        <div className="w-full max-w-4xl text-center relative">
          {/* Circular Progress Ring */}
          <div className="relative inline-block">
            <svg className="w-96 h-96 transform -rotate-90" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="45"
                stroke="#e5e7eb"
                strokeWidth="3"
                fill="none"
                className="opacity-30"
              />
              {/* Single progress circle with gradient */}
              <circle
                cx="50"
                cy="50"
                r="45"
                stroke="url(#scoreGradient)"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
                style={{
                  strokeDasharray: `${2 * Math.PI * 45}`,
                  strokeDashoffset: `${2 * Math.PI * 45 * (1 - displayScore / 100)}`
                }}
              />
              {/* Gradient definition */}
              <defs>
                <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f97316" />
                  <stop offset="50%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#00e054" />
                </linearGradient>
              </defs>
            </svg>
            
            {/* Score Display (centered over the circle) */}
            <div className={`absolute inset-0 flex items-center justify-center text-9xl font-['Space_Grotesk'] ${getScoreColor(compatibility.total_score)} transition-all duration-500 ${
              scoreRevealed ? 'opacity-100 transform-none' : 'opacity-0 translate-y-4'
            }`}>
              {displayScore}%
            </div>
            
            {/* Tagline Display */}
                       <div className={`absolute inset-0 flex items-center justify-center mt-114 text-5xl font-manrope text-black text-center italic transition-all duration-[3000ms] ${
             getTagline(displayScore).includes('Grown Ups 2') ? 'max-w-2xl leading-tight' : 'whitespace-nowrap'
           } ${
             taglineAnimationStart ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
           }`}>
             {taglineAnimationStart && getTagline(displayScore)}
           </div>
           

           
           {/* Scroll indicator arrow */}
           <div className={`absolute inset-0 flex items-center justify-center mt-140 transition-all duration-500 ${
             taglineAnimationStart && arrowVisible ? 'opacity-100' : 'opacity-0'
           }`}>
             <div className="flex flex-col items-center animate-bounce">
               <svg className="w-16 h-12" viewBox="0 0 24 24" fill="none">
                 <path d="M4 10l8 5 8-5" stroke="rgb(0 0 0)" strokeWidth="3" strokeLinecap="butt" strokeLinejoin="miter"/>
               </svg>
             </div>
           </div>

           {/* Common Movies Display */}
           <div className="absolute inset-0 flex flex-col items-center justify-center mt-200">
             {commonMovies.length > 0 ? (
               <div className="flex flex-col items-center">
                 <div className="text-3xl font-manrope text-black mb-6">
                   Your 4 Shared Favorites
                 </div>
                 <div className="flex gap-8 justify-center">
                   {commonMovies.map((movie, index) => (
                     <div key={movie.film_slug} className="flex-shrink-0">
                       {movie.poster_url ? (
                         <a 
                           href={`https://letterboxd.com/film/${movie.film_slug}/`} 
                           target="_blank" 
                           rel="noopener noreferrer"
                           className="block hover:scale-105 transition-transform duration-300"
                         >
                           <img 
                             src={movie.poster_url} 
                             alt={movie.title}
                             className="w-40 h-60 object-cover shadow-lg hover:shadow-2xl transition-shadow duration-300"
                           />
                         </a>
                       ) : (
                         <div className="w-80 h-100 bg-gray-200 rounded-lg shadow-lg flex items-center justify-center">
                           <span className="text-gray-500 text-sm">No Poster</span>
                         </div>
                       )}
                     </div>
                   ))}
                 </div>
               </div>
             ) : (
               <div className="text-gray-500 font-manrope">
                 Finding your shared favorites...
               </div>
             )}
           </div>

           {/* Biggest Disagreement Movie Display */}
           <div className="absolute inset-0 flex items-center justify-center mt-340">
             {disagreementMovie ? (
               <div className="flex items-center gap-12">
                 <div className="flex flex-col items-center">
                   <div className="flex-shrink-0">
                     {disagreementMovie.poster_url ? (
                       <a 
                         href={`https://letterboxd.com/film/${disagreementMovie.film_slug}/`} 
                         target="_blank" 
                         rel="noopener noreferrer"
                         className="block hover:scale-105 transition-transform duration-300"
                       >
                         <img 
                           src={disagreementMovie.poster_url} 
                           alt={disagreementMovie.title}
                           className="max-w-64 max-h-96 object-contain shadow-2xl hover:shadow-3xl transition-shadow duration-300"
                         />
                       </a>
                     ) : (
                       <div className="w-64 h-96 bg-gray-200 rounded-lg shadow-2xl flex items-center justify-center">
                         <span className="text-gray-500 text-sm">No Poster</span>
                       </div>
                     )}
                   </div>
                   <div className="mt-4 text-center">
                     <div className="text-lg font-manrope text-black font-semibold whitespace-nowrap">
                       {(disagreementMovie.title || disagreementMovie.film_slug).replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} ({disagreementMovie.year || 'N/A'}) dir. {disagreementMovie.director || 'Unknown'}
                     </div>
                   </div>
                 </div>
                 <div className="flex flex-col items-center">
                   <div className="text-3xl font-manrope text-black mb-5 whitespace-nowrap text-center">
                     {getDisagreementHeader(disagreementMovie.disagreement_score || 0, disagreementMovie.title)}
                   </div>
                   
                   {/* Review Display */}
                   <div className="space-y-3 max-w-md">
                     {/* Show review box for user A if they have a review */}
                     {disagreementMovie.user_a_review ? (
                       <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 border border-gray-200 shadow-sm">
                         <div className="text-sm font-semibold text-gray-800 mb-1">
                           {disagreementMovie.user_a_handle}'s {formatStarRating(disagreementMovie.user_a_rating)} review:
                         </div>
                         <div className="text-sm text-gray-700 italic leading-relaxed">
                           "{disagreementMovie.user_a_review}"
                         </div>
                       </div>
                     ) : (
                       /* Show just the star rating for user A if no review */
                       <div className="text-sm font-semibold text-gray-800">
                         {disagreementMovie.user_a_handle}: {formatStarRating(disagreementMovie.user_a_rating)}
                       </div>
                     )}
                     
                     {/* Show review box for user B if they have a review */}
                     {disagreementMovie.user_b_review ? (
                       <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 border border-gray-200 shadow-sm">
                         <div className="text-sm font-semibold text-gray-800 mb-1">
                           {disagreementMovie.user_b_handle}'s {formatStarRating(disagreementMovie.user_b_rating)} review:
                         </div>
                         <div className="text-sm text-gray-700 italic leading-relaxed">
                           "{disagreementMovie.user_b_review}"
                         </div>
                       </div>
                     ) : (
                       /* Show just the star rating for user B if no review */
                       <div className="text-sm font-semibold text-gray-800">
                         {disagreementMovie.user_b_handle}: {formatStarRating(disagreementMovie.user_b_rating)}
                       </div>
                     )}
                   </div>
                 </div>
               </div>
             ) : null}
           </div>
          </div>
        </div>
      )}

      {/* Obscurity Alignment Section */}
      {compatibility && compatibility.scores && (
        <div className="w-full text-center mt-360 relative z-10">
          <div className="font-['Space_Grotesk'] italic text-lg text-black">
            the sentence that sums it up:
          </div>
          <div className="mb-10 text-3xl md:text-4xl lg:text-5xl font-manrope leading-tight max-w-5xl mx-auto px-8 bg-gradient-to-r from-orange-500 via-pink-400 to-emerald-500 bg-clip-text text-transparent" style={{ whiteSpace: 'pre-line' }}>
            {getObscurityDescription(compatibility.scores.obscurity_alignment, compatibility.popularity_data?.user_a_average, compatibility.popularity_data?.user_b_average)}
          </div>
        </div>
      )}

      {/* Stats Section */}
      {compatibility && (
        <div className="mt-45">
          <div className="text-center mb-5">
            <h2 className="text-4xl font-manrope text-black">
              Your Stats
            </h2>
          </div>
          
          <div className="bg-gradient-to-r from-orange-300 via-white-300 to-emerald-400 border-4 border-black shadow-[0_0_0_4px_rgba(0,0,0,0.15)] hover:shadow-[0_0_0_4px_rgba(255,255,255,0.3)] animate-gradient-x rounded-2xl max-w-7xl mx-auto p-16">
            {/* First Row: Movies in Common + 2 Blank Spaces */}
            <div className="grid grid-cols-3 gap-16 mb-12">
              {/* Movies in Common */}
              <div className="text-center">
                <div className="text-9xl font-manrope font-bold text-black mb-4">
                  {compatibility.stats?.common_films || 0}
                </div>
                <div className="text-2xl font-['Space_Grotesk'] text-gray-700">
                  Movies in Common
                </div>
              </div>

              {/* Average Rating Difference */}
              <div className="text-center">
                <div className="text-9xl font-manrope font-bold text-black mb-4">
                  {compatibility.stats?.average_rating_difference || 0}
                </div>
                <div className="text-2xl font-['Space_Grotesk'] text-gray-700">
                  Avg ★ Difference
                </div>
              </div>

              {/* Same Rating Percentage */}
              <div className="text-center">
                <div className="text-9xl font-manrope font-bold text-black mb-4">
                  {compatibility.stats?.same_rating_percentage || 0}%
                </div>
                <div className="text-2xl font-['Space_Grotesk'] text-gray-700">
                  Same Ratings
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t-2 border-gray-300 mb-12"></div>

            {/* Second Row: Genres and Directors */}
            <div className="grid grid-cols-2 gap-16">
              {/* Favorite Common Genres */}
              <div className="text-center">
                <div className="space-y-3 mb-4">
                  {compatibility.stats?.favorite_genres && compatibility.stats.favorite_genres.length > 0 ? (
                    compatibility.stats.favorite_genres.map((genre, index) => (
                      <div key={index} className="text-4xl font-manrope font-bold text-black">
                        {genre.name} <span className="text-lg font-normal text-gray-600"> {genre.averageRating}★ avg</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-2xl font-['Space_Grotesk'] text-gray-500">
                      No genres found
                    </div>
                  )}
                </div>
                <div className="text-2xl font-['Space_Grotesk'] text-gray-600">
                  Top Genres
                </div>
              </div>

              {/* Favorite Common Directors */}
              <div className="text-center">
                <div className="space-y-3 mb-4">
                  {compatibility.stats?.favorite_directors && compatibility.stats.favorite_directors.length > 0 ? (
                    compatibility.stats.favorite_directors.map((director, index) => (
                      <div key={index} className="text-4xl font-manrope font-bold text-black">
                        {director.name} <span className="text-lg font-normal text-gray-600"> {director.averageRating}★ avg</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-2xl font-['Space_Grotesk'] text-gray-500">
                      No directors found
                    </div>
                  )}
                </div>
                <div className="text-2xl font-['Space_Grotesk'] text-gray-600">
                  Top Directors
                </div>
              </div>
            </div>
          </div>
          
          {/* Recommendation System Coming Soon */}
          <div className="text-center mt-30">
            <p className="text-2xl font-['Space_Grotesk'] text-gray-600 italic">
              Recommendation System Coming Soon
            </p>
          </div>
          
          {/* Made by Guilherme Lima */}
          <div className="mt-97 text-center">
            <p className="text-sm font-manrope text-gray-500">
              Made by Guilherme Lima
            </p>
          </div>
      </div>
      )}

      {/* Error display */}
      {compatibility && compatibility.error && (
        <div className="bg-red-500/20 backdrop-blur-sm rounded-xl p-4 border border-red-500/30 text-center font-manrope">
          <div className="text-red-400 font-semibold">Error calculating compatibility</div>
          <div className="text-red-300 text-sm">{compatibility.error}</div>
      </div>
      )}

    </div>
  );
}

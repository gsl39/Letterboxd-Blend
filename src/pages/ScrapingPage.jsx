import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import BackgroundGlow from "../components/BackgroundGlow";
import { supabase } from "../supabaseClient";
import { BACKEND_URL } from "../config";

export default function ScrapingPage() {
  const { blendId } = useParams();
  const navigate = useNavigate();
  const [handles, setHandles] = useState({ user_a: null, user_b: null });
  const [isScraping, setIsScraping] = useState(false);
  const [scrapingProgress, setScrapingProgress] = useState(0);
  const [scrapingStatus, setScrapingStatus] = useState('Preparing to scrape...');

  // Fetch handles and start scraping
  useEffect(() => {
    async function fetchHandlesAndStartScraping() {
      try {
        // Get blend data
        const { data } = await supabase
          .from("blends")
          .select("user_a, user_b")
          .eq("blend_id", blendId)
          .single();
        
        if (!data || !data.user_b) {
          console.error('No user_b found in blend');
          navigate(`/blend/${blendId}`);
          return;
        }
        
        setHandles({ user_a: data.user_a, user_b: data.user_b });
        
        // Check if user_b already has movies (no need to scrape)
        const { data: userBMovies } = await supabase
          .from('user_films_with_films')
          .select('film_slug')
          .eq('user_handle', data.user_b)
          .limit(1);
        
        if (userBMovies && userBMovies.length > 0) {
          // User B already has movies, check if both users are ready
          setScrapingStatus('Checking if both users are ready...');
          await checkBothUsersReady();
          return;
        }
        
        // Start scraping for user_b
        console.log('Starting scraping for user_b:', data.user_b);
        setIsScraping(true);
        setScrapingStatus('Scraping movies from Letterboxd...');
        
        // Simulate progress updates
        const progressInterval = setInterval(() => {
          setScrapingProgress(prev => {
            if (prev >= 90) {
              clearInterval(progressInterval);
              return 90;
            }
            return prev + Math.random() * 15;
          });
        }, 1000);
        
        try {
          const response = await fetch(`${BACKEND_URL}/api/scrape`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              handle: data.user_b, 
              blend_id: blendId, 
              user: 'b' 
            }),
          });
          
          if (response.ok) {
            console.log('Scraping completed for user_b:', data.user_b);
            setScrapingProgress(100);
            setScrapingStatus('Scraping complete! Checking if both users are ready...');
            
            // Now check if both users are ready
            await checkBothUsersReady();
          } else {
            throw new Error('Scraping failed');
          }
        } catch (error) {
          console.error('Scraping failed:', error);
          setScrapingStatus('Scraping failed. Please try again.');
          setScrapingProgress(0);
          
          // Show error for a few seconds, then redirect back
          setTimeout(() => {
            navigate(`/blend/${blendId}`);
          }, 3000);
        }
        
      } catch (error) {
        console.error('Error:', error);
        navigate(`/blend/${blendId}`);
      }
    }
    
    // Helper function to check if both users are ready
    async function checkBothUsersReady() {
      try {
        // Check if both users have movies
        const [userAMovies, userBMovies] = await Promise.all([
          supabase
            .from('user_films_with_films')
            .select('film_slug')
            .eq('user_handle', handles.user_a || '')
            .limit(1),
          supabase
            .from('user_films_with_films')
            .select('film_slug')
            .eq('user_handle', handles.user_b || '')
            .limit(1)
        ]);
        
        if (userAMovies.data && userAMovies.data.length > 0 && 
            userBMovies.data && userBMovies.data.length > 0) {
          setScrapingStatus('Both users ready! Redirecting to results...');
          
          // Wait a moment to show completion, then redirect
          setTimeout(() => {
            navigate(`/blend/${blendId}/results`);
          }, 1500);
        } else {
          setScrapingStatus('Waiting for both users to be ready...');
          // Check again in 2 seconds
          setTimeout(checkBothUsersReady, 2000);
        }
      } catch (error) {
        console.error('Error checking user readiness:', error);
        setScrapingStatus('Error checking readiness. Please try again.');
      }
    }
    
    fetchHandlesAndStartScraping();
  }, [blendId, navigate, handles.user_a, handles.user_b]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 font-manrope">
      <div className="fixed inset-0 -z-10">
        <BackgroundGlow isScoreRevealed={false} />
      </div>
      
      {/* Just the loading ring */}
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
            {scrapingStatus}
          </div>
        </div>
      </div>
    </div>
  );
}

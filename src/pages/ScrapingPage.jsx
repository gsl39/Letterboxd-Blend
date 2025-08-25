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

  // Fetch handles and start scraping with strict verification
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
        
        // STRICT CHECK 1: Verify user A has movies (should already be scraped)
        setScrapingStatus('Verifying User A movies...');
        const { data: userAMovies, error: userAError } = await supabase
          .from('user_films_with_films')
          .select('film_slug')
          .eq('user_handle', data.user_a);
        
        if (userAError) {
          console.error('Error checking User A movies:', userAError);
          setScrapingStatus('Error checking User A. Please try again.');
          return;
        }
        
        if (!userAMovies || userAMovies.length === 0) {
          setScrapingStatus('User A has no movies. Please start over.');
          setTimeout(() => navigate(`/blend/${blendId}`), 3000);
          return;
        }
        
        console.log(`✅ User A has ${userAMovies.length} movies`);
        
        // STRICT CHECK 2: Check if user B already has movies
        setScrapingStatus('Checking User B movies...');
        const { data: userBMovies, error: userBError } = await supabase
          .from('user_films_with_films')
          .select('film_slug')
          .eq('user_handle', data.user_b);
        
        if (userBError) {
          console.error('Error checking User B movies:', userBError);
          setScrapingStatus('Error checking User B. Please try again.');
          return;
        }
        
        if (userBMovies && userBMovies.length > 0) {
          console.log(`✅ User B already has ${userBMovies.length} movies`);
          setScrapingStatus('Both users ready! Verifying metadata...');
          await verifyBothUsersComplete();
          return;
        }
        
        // STRICT CHECK 3: User B needs scraping - start the process
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
            setScrapingStatus('Scraping complete! Verifying data...');
            
            // STRICT CHECK 4: Verify scraping actually worked
            await verifyScrapingSuccess(data.user_b);
          } else {
            const errorText = await response.text();
            throw new Error(`Scraping failed: ${errorText}`);
          }
        } catch (error) {
          console.error('Scraping failed:', error);
          setScrapingStatus(`Scraping failed: ${error.message}`);
          setScrapingProgress(0);
          
          // Show error for a few seconds, then redirect back
          setTimeout(() => {
            navigate(`/blend/${blendId}`);
          }, 5000);
        }
        
      } catch (error) {
        console.error('Error:', error);
        setScrapingStatus(`Error: ${error.message}`);
        setTimeout(() => navigate(`/blend/${blendId}`), 3000);
      }
    }
    
    // STRICT VERIFICATION: Verify scraping actually worked
    async function verifyScrapingSuccess(userBHandle) {
      let attempts = 0;
      const maxAttempts = 10;
      
      const verify = async () => {
        attempts++;
        setScrapingStatus(`Verifying scraping success... (attempt ${attempts}/${maxAttempts})`);
        
        try {
          // Check if user B now has movies
          const { data: userBMovies, error: userBError } = await supabase
            .from('user_films_with_films')
            .select('film_slug')
            .eq('user_handle', userBHandle);
          
          if (userBError) {
            throw userBError;
          }
          
          if (userBMovies && userBMovies.length > 0) {
            console.log(`✅ User B now has ${userBMovies.length} movies`);
            setScrapingStatus('Scraping verified! Checking metadata...');
            await verifyBothUsersComplete();
          } else {
            if (attempts >= maxAttempts) {
              setScrapingStatus('Scraping verification failed after multiple attempts');
              setTimeout(() => navigate(`/blend/${blendId}`), 5000);
            } else {
              setScrapingStatus(`Waiting for data to appear... (attempt ${attempts}/${maxAttempts})`);
              setTimeout(verify, 2000);
            }
          }
        } catch (error) {
          console.error('Verification error:', error);
          if (attempts >= maxAttempts) {
            setScrapingStatus('Verification failed. Please try again.');
            setTimeout(() => navigate(`/blend/${blendId}`), 5000);
          } else {
            setTimeout(verify, 2000);
          }
        }
      };
      
      await verify();
    }
    
    // STRICT VERIFICATION: Verify both users are completely ready
    async function verifyBothUsersComplete() {
      let attempts = 0;
      const maxAttempts = 15;
      
      const verify = async () => {
        attempts++;
        setScrapingStatus(`Verifying both users complete... (attempt ${attempts}/${maxAttempts})`);
        
        try {
          // STRICT CHECK 5: Use backend endpoint to verify user status
          setScrapingStatus('Checking user A status via backend...');
          const userAResponse = await fetch(`${BACKEND_URL}/api/user-scraping-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ handle: handles.user_a })
          });
          
          if (!userAResponse.ok) {
            throw new Error('Failed to check User A status');
          }
          
          const userAStatus = await userAResponse.json();
          console.log('User A status:', userAStatus);
          
          if (!userAStatus.hasMovies) {
            setScrapingStatus('User A has no movies. Please start over.');
            setTimeout(() => navigate(`/blend/${blendId}`), 5000);
            return;
          }
          
          setScrapingStatus('Checking user B status via backend...');
          const userBResponse = await fetch(`${BACKEND_URL}/api/user-scraping-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ handle: handles.user_b })
          });
          
          if (!userBResponse.ok) {
            throw new Error('Failed to check User B status');
          }
          
          const userBStatus = await userBResponse.json();
          console.log('User B status:', userBStatus);
          
          if (!userBStatus.hasMovies) {
            setScrapingStatus('User B has no movies. Please try again.');
            if (attempts >= maxAttempts) {
              setScrapingStatus('User B verification timeout. Please try again.');
              setTimeout(() => navigate(`/blend/${blendId}`), 5000);
            } else {
              setTimeout(verify, 3000);
            }
            return;
          }
          
          console.log(`📊 User A: ${userAStatus.movieCount} movies (${userAStatus.status}), User B: ${userBStatus.movieCount} movies (${userBStatus.status})`);
          
          // STRICT CHECK 6: Verify metadata is ready via backend
          setScrapingStatus('Checking metadata readiness via backend...');
          const metadataResponse = await fetch(`${BACKEND_URL}/api/metadata-ready`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_a: handles.user_a,
              user_b: handles.user_b
            })
          });
          
          if (metadataResponse.ok) {
            const metadataStatus = await metadataResponse.json();
            console.log('Metadata status:', metadataStatus);
            
            if (metadataStatus.ready) {
              setScrapingStatus('🎯 ALL SYSTEMS READY! Redirecting to results...');
              setTimeout(() => {
                navigate(`/blend/${blendId}/results`);
              }, 2000);
              return;
            } else {
              setScrapingStatus(`Metadata not ready: ${metadataStatus.metadata_status.total_missing} missing`);
              if (attempts >= maxAttempts) {
                setScrapingStatus('Metadata verification timeout. Please try again.');
                setTimeout(() => navigate(`/blend/${blendId}`), 5000);
              } else {
                setTimeout(verify, 3000);
              }
            }
          } else {
            throw new Error('Failed to check metadata readiness');
          }
        } catch (error) {
          console.error('Verification error:', error);
          if (attempts >= maxAttempts) {
            setScrapingStatus('Verification failed. Please try again.');
            setTimeout(() => navigate(`/blend/${blendId}`), 5000);
          } else {
            setTimeout(verify, 3000);
          }
        }
      };
      
      await verify();
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

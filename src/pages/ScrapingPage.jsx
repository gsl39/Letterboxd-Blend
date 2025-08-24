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
            setScrapingStatus('Scraping complete! Redirecting to results...');
            
            // Wait a moment to show completion, then redirect
            setTimeout(() => {
              navigate(`/blend/${blendId}/results`);
            }, 1500);
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
    
    fetchHandlesAndStartScraping();
  }, [blendId, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center p-4 font-manrope pt-16">
      <div className="fixed inset-0 -z-10">
        <BackgroundGlow isScoreRevealed={false} />
      </div>
      
      {/* Show title and usernames */}
      <h1 className="text-5xl mb-17 font-manrope">Scraping Movies</h1>
      
      <div className="text-3xl font-bold mb-20">
        <a href={`https://letterboxd.com/${handles.user_a}/`} target="_blank" rel="noopener noreferrer" className="inline-block">
          <span className="font-['Space_Grotesk'] text-black px-6 py-3 rounded-2xl hover:scale-125 hover:rotate-2 transition-all duration-500 drop-shadow-[0_0_20px_rgba(251,146,60,0.4)] hover:drop-shadow-[0_0_30px_rgba(251,146,60,0.6)] drop-shadow-[0_4px_8px_rgba(0,0,0,0.2)] drop-shadow-[0_8px_16px_rgba(0,0,0,0.15)] relative z-10 bg-gradient-to-r from-orange-400 via-white-500 to-cyan-400 border-4 border-black shadow-[0_0_0_4px_rgba(0,0,0,0.15)] hover:shadow-[0_0_0_4px_rgba(255,255,255,0.3)] animate-gradient-x cursor-pointer">
            {handles.user_a || 'User A'}
          </span>
        </a>
        <span className="mx-8 text-gray-400 text-2xl relative z-10">×</span>
        <a href={`https://letterboxd.com/${handles.user_b}/`} target="_blank" rel="noopener noreferrer" className="inline-block">
          <span className="font-['Space_Grotesk'] text-black px-6 py-3 rounded-2xl hover:scale-125 hover:-rotate-2 transition-all duration-500 drop-shadow-[0_0_20px_rgba(34,211,238,0.4)] hover:drop-shadow-[0_0_30px_rgba(34,211,238,0.6)] drop-shadow-[0_4px_8px_rgba(0,0,0,0.2)] drop-shadow-[0_8px_16px_rgba(0,0,0,0.15)] relative z-10 bg-gradient-to-r from-cyan-400 via-emerald-300 to-emerald-400 border-4 border-black shadow-[0_0_0_4px_rgba(0,0,0,0.15)] hover:shadow-[0_0_0_4px_rgba(255,255,255,0.3)] animate-gradient-x cursor-pointer">
            {handles.user_b || 'User B'}
          </span>
        </a>
      </div>

      {/* Loading animation - EXACTLY copied from BlendResultsPage */}
      <div className="w-full max-w-4xl text-center">
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
        
        {/* Progress indicator */}
        <div className="mt-8">
          <div className="w-64 bg-gray-200 rounded-full h-3 mx-auto">
            <div 
              className="bg-gradient-to-r from-orange-500 via-blue-500 to-green-500 h-3 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${scrapingProgress}%` }}
            ></div>
          </div>
          <div className="text-lg font-manrope text-gray-600 mt-2">
            {Math.round(scrapingProgress)}% Complete
          </div>
        </div>
      </div>
    </div>
  );
}

import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import BackgroundGlow from "../components/BackgroundGlow";
import { supabase } from "../supabaseClient";
import { BACKEND_URL } from "../config";

export default function ScrapingPage() {
  const { blendId } = useParams();
  const navigate = useNavigate();
  const [handles, setHandles] = useState({ user_a: null, user_b: null });
  const [scrapingStatus, setScrapingStatus] = useState('Preparing to scrape...');

  // Fetch handles and start scraping with simple event-driven logic
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
          console.error('No user_b found in blend, waiting for database update...');
          setScrapingStatus('Waiting for User B to join...');
          
          // Wait a bit for database to update, then retry
          setTimeout(() => {
            fetchHandlesAndStartScraping();
          }, 2000);
          return;
        }
        
        setHandles({ user_a: data.user_a, user_b: data.user_b });
        
        // Scrape both users with one API call
        setScrapingStatus('Starting scraping for both users...');
        
        console.log(`🚀 Starting scraping for both users: ${data.user_a} and ${data.user_b}`);
        
        // Single API call that scrapes both users
        const response = await fetch(`${BACKEND_URL}/api/scrape-join-blend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blend_id: blendId }),
        });
        
        const result = await response.json();
        console.log(`✅ Both users scraping completed:`, result);
        
        setScrapingStatus('Both users scraped! Redirecting to results...');
        
        // Both users scraped, redirect to results
        setTimeout(() => {
          navigate(`/blend/${blendId}/results`);
        }, 2000);
        
      } catch (error) {
        console.error('Error:', error);
        setScrapingStatus(`Error: ${error.message}. Please refresh the page to try again.`);
      }
    }
    
    fetchHandlesAndStartScraping();
  }, [blendId, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 font-manrope">
      <div className="fixed inset-0 -z-10">
        <BackgroundGlow isScoreRevealed={false} />
      </div>
      
      {/* Loading ring */}
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
      </div>
      
      {/* Status text */}
      <div className="mt-8 text-center">
        <p className="text-lg text-gray-700 font-medium">{scrapingStatus}</p>
      </div>
    </div>
  );
}

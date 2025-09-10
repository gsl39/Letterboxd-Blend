import BackgroundGlow from "../components/BackgroundGlow";
import EmailSignup from "../components/EmailSignUps";
import QRCodeDisplay from "../components/qrCode";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { BACKEND_URL } from "../config";

export default function StartBlendPage() {
  const [handle, setHandle] = useState("");
  const [blendId, setBlendId] = useState(null);
  const navigate = useNavigate();

  const handleStartBlend = async (userHandle) => {
    // Remove @ symbol if username starts with it
    const cleanHandle = userHandle.startsWith('@') ? userHandle.slice(1) : userHandle;
    
    setHandle(cleanHandle);
    const blend_id = crypto.randomUUID();

    // Store in Supabase
    await supabase.from('blends').insert([{ blend_id, user_a: cleanHandle }]);
    setBlendId(blend_id);

    // Wait for both users to join, then scrape both with one API call
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("blends")
        .select("user_a, user_b")
        .eq("blend_id", blend_id)
        .single();
      
      if (data && data.user_a && data.user_b) {
        clearInterval(interval);
        
        console.log(`🚀 Both users joined! Starting scraping for both: ${data.user_a} and ${data.user_b}`);
        
        // Single API call that scrapes both users
        const response = await fetch(`${BACKEND_URL}/api/scrape-start-blend`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blend_id }),
        });
        
        const result = await response.json();
        console.log(`✅ Both users scraping completed:`, result);
        
        // Both users scraped, redirect to results
        navigate(`/blend/${blend_id}/results`);
      }
    }, 2000);
  };

  // No more polling - User A redirects immediately after scraping

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="fixed inset-0 -z-10">
        <BackgroundGlow />
      </div>

      {!blendId ? (
        <EmailSignup onSubmit={handleStartBlend} />
      ) : (
        <QRCodeDisplay blendId={blendId} />
      )}

      {/* Made by Guilherme Lima */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
        <p className="text-sm font-manrope text-gray-500">
          Made by Guilherme Lima
        </p>
      </div>
    </div>
  );
}

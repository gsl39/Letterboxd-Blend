import BackgroundGlow from "../components/BackgroundGlow";
import EmailSignup from "../components/EmailSignUps";
import QRCodeDisplay from "../components/qrCode";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

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

    // Call your Express API to scrape movies for User A
    await fetch('http://localhost:3001/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: cleanHandle, blend_id, user: 'a' }),
    });
  };

  useEffect(() => {
    if (!blendId) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("blends")
        .select("user_b")
        .eq("blend_id", blendId)
        .single();
      if (data && data.user_b) {
        clearInterval(interval);
        navigate(`/blend/${blendId}/results`);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [blendId, navigate]);

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

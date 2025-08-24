import { useNavigate, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import BackgroundGlow from "../components/BackgroundGlow";
import EmailSignup from "../components/EmailSignUps";
import { supabase } from "../supabaseClient";

export default function JoinBlendPage() {
    const { blendId } = useParams();
    const navigate = useNavigate();
    const [inviterUsername, setInviterUsername] = useState("");

    // Fetch the inviter's username when component mounts
    useEffect(() => {
        const fetchInviterUsername = async () => {
            const { data } = await supabase
                .from('blends')
                .select('user_a')
                .eq('blend_id', blendId)
                .single();
            
            if (data && data.user_a) {
                setInviterUsername(data.user_a);
            }
        };

        fetchInviterUsername();
    }, [blendId]);

    const handleJoinBlend = async (handle) => {
        // Remove @ symbol if username starts with it
        const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle;
        
        // Update the database and navigate to scraping page
        await supabase
            .from('blends')
            .update({ user_b: cleanHandle })
            .eq('blend_id', blendId);

        // Navigate to scraping page instead of results
        navigate(`/blend/${blendId}/scraping`);
    };

    return (
        <div className="relative min-h-screen overflow-hidden">
            <div className="fixed inset-0 -z-10">
                <BackgroundGlow />  
            </div>
            <EmailSignup
                onSubmit={handleJoinBlend}
                label={inviterUsername ? `${inviterUsername} invited you to Blend.` : "Your friend invited you to Blend."}
            />

            {/* Made by Guilherme Lima */}
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
                <p className="text-sm font-manrope text-gray-500">
                    Made by Guilherme Lima
                </p>
            </div>
        </div>
    );
}
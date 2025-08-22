import BackgroundGlow from "../components/BackgroundGlow";
import BlendResultsPreview from "../components/BlendResultsPreview";
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./SplashPage.css";

export default function SplashPage() {
  const navigate = useNavigate();
  const [showTransitionBox, setShowTransitionBox] = useState(false);

  const handleSignUpClick = useCallback(() => {
    navigate("/start-blend");
  }, [navigate]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const triggerPoint = 100;

      if (scrollY > triggerPoint && !showTransitionBox) {
        setShowTransitionBox(true);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [showTransitionBox]);

  return (
    <div className="splash-container">
      <div className="fixed inset-0 -z-10">
        <BackgroundGlow />
      </div>

      <h1 className="splash-title">
        Friendship,<br /> <span>Framed Through Film</span>
      </h1>

      {showTransitionBox && (
        <div className="transition-box">
          <div className="transition-box-inner fade-in-once">
            <BlendResultsPreview />
          </div>
        </div>
      )}

      <div className="button-container">
        <button 
          onClick={handleSignUpClick}
          className="animated-button"
          aria-label="Get started with Letterboxd Blend"
        >
          {/* Orange glow orb */}
          <div 
            className="glow-orb-1"
            aria-hidden="true"
          />
          
          {/* Green glow orb */}
          <div 
            className="glow-orb-2"
            aria-hidden="true"
          />
          
          Get Started
        </button>
      </div>

      {/* Made by Guilherme Lima */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
        <p className="text-sm font-manrope text-gray-500">
          Made by Guilherme Lima
        </p>
      </div>
    </div>
  );
}


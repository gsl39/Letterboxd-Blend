import React from 'react';
export default function BackgroundGlow() {
    return (
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 -z-10 h-full w-full bg-white">
          {/* Glow 1 */}
          <div className="absolute top-0 right-0 h-[500px] w-[500px] -translate-x-[5%] translate-y-[35%] rounded-full bg-[rgba(0,224,84,0.9)] opacity-100 blur-[150px] glow-animate" />
  
          {/* Glow 2 */}
          <div className="absolute bottom-0 left-0 h-[500px] w-[500px] translate-x-[45%] -translate-y-[-20%] rounded-full bg-[rgba(64,188,244,0.9)] opacity-100 blur-[150px] glow-animate" />

          {/* Glow 3 */}
          <div className="absolute bottom-0 left-0 h-[500px] w-[500px] translate-x-[-10%] -translate-y-[80%] rounded-full bg-[rgba(255,128,0,0.9)] opacity-100 blur-[150px] glow-animate" />
        </div>
      </div>
    );
  }
  
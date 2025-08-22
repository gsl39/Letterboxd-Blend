import { useState, useEffect } from 'react';

export default function BlendResultsPreview() {
  return (
    <div className="w-full h-full flex items-center justify-center p-4">
      {/* Screenshot Image - fills the entire box */}
      <img 
        src="/blend-results-screenshot.png" 
        alt="Blend Results Preview"
        className="w-full h-full object-cover rounded-lg"
      />
    </div>
  );
}

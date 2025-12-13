/**
 * Background Image Component
 * 
 * Theme-aware background image that switches between light and dark mode images.
 * Uses semi-transparent overlays so the painting is visible but covered.
 * The image fades in as data loads, creating a beautiful loading experience.
 */

'use client';

import { useState, useEffect } from 'react';

export function BackgroundImage() {
  const [imageLoaded, setImageLoaded] = useState(false);
  
  // Use different images for light and dark mode
  const lightImage = '/understorylight.png';
  const darkImage = '/understory.jpeg';

  useEffect(() => {
    // Preload images and fade in when loaded
    const lightImg = new Image();
    const darkImg = new Image();
    
    let loadedCount = 0;
    const handleLoad = () => {
      loadedCount++;
      if (loadedCount === 2) {
        // Both images loaded, fade in
        setTimeout(() => setImageLoaded(true), 100);
      }
    };

    lightImg.onload = handleLoad;
    darkImg.onload = handleLoad;
    
    lightImg.src = lightImage;
    darkImg.src = darkImage;
  }, []);

  return (
    <>
      {/* Light Mode Background - NO OVERLAYS */}
      <div 
        className={`fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat dark:hidden transition-opacity duration-1000 ${
          imageLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          backgroundImage: `url(${lightImage})`,
        }}
      />
      
      {/* Dark Mode Background - NO OVERLAYS */}
      <div 
        className={`hidden dark:block fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat transition-opacity duration-1000 ${
          imageLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        style={{
          backgroundImage: `url(${darkImage})`,
        }}
      />
    </>
  );
}


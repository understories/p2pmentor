/**
 * Background Image Component
 * 
 * Theme-aware background image that switches between light and dark mode images.
 * Uses Tailwind's dark mode classes for seamless theme switching.
 */

export function BackgroundImage() {
  // Use different images for light and dark mode
  const lightImage = '/understorylight.png';
  const darkImage = '/understory.jpeg';

  return (
    <>
      {/* Light Mode Background - no overlay, show image directly */}
      <div 
        className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat dark:hidden"
        style={{
          backgroundImage: `url(${lightImage})`,
        }}
      />
      {/* Dark Mode Background - no overlay, show image directly */}
      <div 
        className="hidden dark:block fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${darkImage})`,
        }}
      />
    </>
  );
}


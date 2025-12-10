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
      {/* Light Mode Background */}
      <div 
        className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat opacity-40 dark:hidden"
        style={{
          backgroundImage: `url(${lightImage})`,
        }}
      />
      {/* Dark Mode Background */}
      <div 
        className="hidden dark:block fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat opacity-25"
        style={{
          backgroundImage: `url(${darkImage})`,
        }}
      />
      {/* Overlay for better text readability - stronger in light mode for accessibility */}
      <div className="fixed inset-0 -z-10 bg-white/60 dark:bg-gray-900/50" />
    </>
  );
}


'use client';

/**
 * Global Understories "Grown by" button
 * 
 * Floating button with sprout icon that links to Understories.
 * Positioned to the left of Arkiv button.
 */

export function UnderstoriesButton() {
  return (
    <a
      href="https://understories.github.io"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-[240px] z-50 flex items-center justify-center w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 dark:from-green-400 dark:to-emerald-500 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
      title="Grown by Understories - Tech and social innovations"
      aria-label="Grown by Understories"
    >
      {/* Sprout icon - simple growing plant */}
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        {/* Stem */}
        <path d="M12 2v8"/>
        {/* Left leaf */}
        <path d="M8 6c-2 2-2 4 0 6"/>
        {/* Right leaf */}
        <path d="M16 6c2 2 2 4 0 6"/>
        {/* Small sprout on top */}
        <circle cx="12" cy="4" r="1.5" fill="currentColor"/>
      </svg>
    </a>
  );
}


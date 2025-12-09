'use client';

/**
 * Global Arkiv "Powered by" button
 * 
 * Floating button that links to Arkiv network.
 * Positioned to the left of GitHub button.
 */

export function ArkivButton() {
  return (
    <a
      href="http://arkiv.network"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-[168px] z-50 flex items-center justify-center w-12 h-12 bg-gradient-to-br from-purple-600 to-indigo-700 dark:from-purple-500 dark:to-indigo-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 font-bold text-lg"
      title="Powered by Arkiv - Universal data layer for Ethereum"
      aria-label="Powered by Arkiv"
    >
      <span className="leading-none">[A]</span>
    </a>
  );
}


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
      className="fixed bottom-6 right-[168px] z-50 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-indigo-700 text-lg font-bold text-white shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl dark:from-purple-500 dark:to-indigo-600"
      title="Powered by Arkiv - Universal data layer for Ethereum"
      aria-label="Powered by Arkiv"
    >
      <span className="leading-none">[A]</span>
    </a>
  );
}

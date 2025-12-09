/**
 * Feedback Button Component
 * 
 * Floating button to open app feedback modal from any page.
 * 
 * Reference: refs/docs/sprint2.md Section 4.1
 */

'use client';

import { useState, useEffect } from 'react';
import { AppFeedbackModal } from './AppFeedbackModal';

export function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [wallet, setWallet] = useState<string | null>(null);

  useEffect(() => {
    // Get wallet from localStorage if available
    const getWallet = () => {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('wallet_address');
        if (stored) {
          setWallet(stored);
        }
      }
    };

    // Check immediately
    getWallet();

    // Listen for storage changes (in case wallet is set/updated)
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', getWallet);
      // Also check periodically in case localStorage was updated in same window
      const interval = setInterval(getWallet, 1000);
      return () => {
        window.removeEventListener('storage', getWallet);
        clearInterval(interval);
      };
    }
  }, []);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2 group"
        aria-label="Share feedback"
        title="Share your feedback about p2pmentor"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
          />
        </svg>
        <span className="hidden sm:inline text-sm font-medium group-hover:scale-105 transition-transform">
          Feedback
        </span>
      </button>
      <AppFeedbackModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        userWallet={wallet}
      />
    </>
  );
}


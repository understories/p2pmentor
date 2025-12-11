/**
 * Identity Step Component
 * 
 * Step 1: Create identity (display name + optional exploring statement)
 */

'use client';

import { useState } from 'react';

interface IdentityStepProps {
  wallet: string;
  onComplete: () => void;
  onError: (error: Error) => void;
}

export function IdentityStep({ wallet, onComplete, onError }: IdentityStepProps) {
  const [displayName, setDisplayName] = useState('');
  const [exploringStatement, setExploringStatement] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!displayName.trim()) {
      onError(new Error('Display name is required'));
      return;
    }

    setIsSubmitting(true);

    try {
      // Get timezone from browser
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Use API route for profile creation (uses global Arkiv signing wallet)
      // wallet is the profile wallet address (from localStorage 'wallet_address')
      // This is used as the 'wallet' attribute on the profile entity
      // The API route uses getPrivateKey() (global signing wallet) to sign the transaction
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createProfile',
          wallet, // Profile wallet address (used as 'wallet' attribute on entity)
          displayName: displayName.trim(),
          bio: exploringStatement.trim() || undefined,
          bioShort: exploringStatement.trim() || undefined, // Use exploring statement as bioShort
          timezone,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        // Small delay for visual feedback (seed "pops")
        setTimeout(() => {
          onComplete();
        }, 300);
      } else {
        throw new Error(data.error || 'Failed to create profile');
      }
    } catch (err) {
      onError(err instanceof Error ? err : new Error('Failed to create profile'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div 
          className={`text-6xl mb-4 transition-all duration-300 ${
            displayName.trim() ? 'hg-anim-plant-sparkle' : 'animate-pulse'
          }`}
        >
          🌱
        </div>
        <h2 className="text-2xl font-bold mb-2">Create Your Identity</h2>
        <p className="text-gray-600 dark:text-gray-400">
          Your identity is the seed from which everything grows.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium mb-2">
            Display Name <span className="text-red-500">*</span>
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="How should we call you?"
            required
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label htmlFor="exploringStatement" className="block text-sm font-medium mb-2">
            What are you exploring? <span className="text-gray-500 text-xs">(optional)</span>
          </label>
          <textarea
            id="exploringStatement"
            value={exploringStatement}
            onChange={(e) => setExploringStatement(e.target.value)}
            placeholder="A one-line statement about what you're exploring or becoming..."
            rows={2}
            maxLength={200}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
            disabled={isSubmitting}
          />
          <p className="text-xs text-gray-500 mt-1">
            {exploringStatement.length}/200
          </p>
        </div>

        <button
          type="submit"
          disabled={!displayName.trim() || isSubmitting}
          className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200 font-medium disabled:opacity-50"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">🌱</span>
              <span>Growing your seed...</span>
            </span>
          ) : (
            'Grow Seed →'
          )}
        </button>
      </form>
    </div>
  );
}

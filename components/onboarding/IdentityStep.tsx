/**
 * Identity Step Component
 * 
 * Step 1: Create identity (display name + optional exploring statement)
 */

'use client';

import { useState } from 'react';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';

interface IdentityStepProps {
  wallet: string;
  onComplete: () => void;
  onError: (error: Error) => void;
}

export function IdentityStep({ wallet, onComplete, onError }: IdentityStepProps) {
  const [displayName, setDisplayName] = useState('');
  const [exploringStatement, setExploringStatement] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const arkivBuilderMode = useArkivBuilderMode();

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
        // Track action completion
        const { trackActionCompletion } = await import('@/lib/metrics/actionCompletion');
        trackActionCompletion('profile_created');

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
    <div className="space-y-8 animate-fade-in">
      <div className="text-center">
        <div 
          className={`text-6xl mb-4 transition-all duration-300 ${
            displayName.trim() ? 'hg-anim-plant-sparkle' : 'animate-pulse'
          }`}
          style={{
            filter: displayName.trim() ? 'drop-shadow(0 0 20px rgba(34, 197, 94, 0.8)) drop-shadow(0 0 40px rgba(34, 197, 94, 0.4))' : 'none',
          }}
        >
          🌱
        </div>
        <h2 
          className="text-4xl md:text-5xl font-bold mb-4 text-white dark:text-white drop-shadow-lg"
          style={{
            textShadow: '0 0 20px rgba(34, 197, 94, 0.5), 0 0 40px rgba(34, 197, 94, 0.3)',
          }}
        >
          Create Your Identity
        </h2>
        <p 
          className="text-gray-200 dark:text-gray-300 text-lg drop-shadow-md"
          style={{
            textShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
          }}
        >
          Your identity is the seed from which everything grows.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="How should we call you?"
            required
            autoFocus
            className="w-full px-6 py-4 text-lg border-2 border-white/30 dark:border-white/20 rounded-xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-md text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all shadow-lg"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <textarea
            id="exploringStatement"
            value={exploringStatement}
            onChange={(e) => setExploringStatement(e.target.value)}
            placeholder="What are you exploring? (optional)"
            rows={2}
            maxLength={200}
            className="w-full px-6 py-4 text-lg border-2 border-white/30 dark:border-white/20 rounded-xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-md text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all resize-none shadow-lg"
            disabled={isSubmitting}
          />
          <p 
            className="text-xs text-gray-200 dark:text-gray-300 mt-2 text-right drop-shadow-md"
            style={{
              textShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
            }}
          >
            {exploringStatement.length}/200
          </p>
        </div>

        {arkivBuilderMode ? (
          <ArkivQueryTooltip
            query={[
              `POST /api/profile { action: 'createProfile', ... }`,
              `Creates: type='user_profile' entity`,
              `Attributes: wallet='${wallet.toLowerCase().slice(0, 8)}...', displayName, timezone`,
              `Payload: Full profile data (bio, bioShort, etc.)`,
              `TTL: 1 year (31536000 seconds)`
            ]}
            label="Continue"
          >
            <button
              type="submit"
              disabled={!displayName.trim() || isSubmitting}
              className="w-full px-6 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 font-medium text-lg disabled:opacity-50 shadow-lg hover:shadow-xl"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin">🌱</span>
                  <span>Growing your seed...</span>
                </span>
              ) : (
                'Continue →'
              )}
            </button>
          </ArkivQueryTooltip>
        ) : (
          <button
            type="submit"
            disabled={!displayName.trim() || isSubmitting}
            className="w-full px-6 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 font-medium text-lg disabled:opacity-50 shadow-lg hover:shadow-xl"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">🌱</span>
                <span>Growing your seed...</span>
              </span>
            ) : (
              'Continue →'
            )}
          </button>
        )}
      </form>
    </div>
  );
}

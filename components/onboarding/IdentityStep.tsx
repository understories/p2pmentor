/**
 * Identity Step Component
 * 
 * Step 1: Create identity (display name + username + optional exploring statement)
 * Username can only be set during onboarding and must be unique.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
import { checkUsernameExists } from '@/lib/arkiv/profile';

interface IdentityStepProps {
  wallet: string;
  onComplete: () => void;
  onError: (error: Error) => void;
}

export function IdentityStep({ wallet, onComplete, onError }: IdentityStepProps) {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [exploringStatement, setExploringStatement] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const arkivBuilderMode = useArkivBuilderMode();
  const usernameCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Real-time username uniqueness checking
  useEffect(() => {
    if (usernameCheckTimeoutRef.current) {
      clearTimeout(usernameCheckTimeoutRef.current);
    }

    if (!username.trim()) {
      setUsernameError(null);
      return;
    }

    // Validate username format (alphanumeric, underscore, hyphen, 3-20 chars)
    const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
    if (!usernameRegex.test(username.trim())) {
      setUsernameError('Username must be 3-20 characters, alphanumeric with _ or -');
      return;
    }

    // Debounce username check
    setIsCheckingUsername(true);
    usernameCheckTimeoutRef.current = setTimeout(async () => {
      try {
        const existingProfiles = await checkUsernameExists(username.trim());
        // Filter out profiles from the same wallet (user can reuse their own username)
        const otherWalletProfiles = existingProfiles.filter(p => 
          p.wallet.toLowerCase() !== wallet.toLowerCase()
        );
        
        if (otherWalletProfiles.length > 0) {
          setUsernameError('Username already taken');
        } else {
          setUsernameError(null);
        }
      } catch (err) {
        console.error('Error checking username:', err);
        // Don't block on check error, let API handle it
        setUsernameError(null);
      } finally {
        setIsCheckingUsername(false);
      }
    }, 500); // 500ms debounce

    return () => {
      if (usernameCheckTimeoutRef.current) {
        clearTimeout(usernameCheckTimeoutRef.current);
      }
    };
  }, [username, wallet]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!displayName.trim()) {
      onError(new Error('Display name is required'));
      return;
    }

    if (!username.trim()) {
      onError(new Error('Username is required'));
      return;
    }

    if (usernameError) {
      onError(new Error(usernameError));
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
          username: username.trim(),
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
        // Handle username duplicate error
        if (res.status === 409 && data.error === 'Username already exists') {
          setUsernameError('Username already exists');
          throw new Error('Username already exists');
        }
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
        <p 
          className="text-gray-300 dark:text-gray-400 text-sm mt-3 drop-shadow-md max-w-2xl mx-auto"
          style={{
            textShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
          }}
        >
          All data you enter here is stored on the Arkiv network. This means it is visible and verifiable on their{' '}
          <a 
            href="http://explorer.mendoza.hoodi.arkiv.network/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-green-400 hover:text-green-300 underline"
          >
            Arkiv explorer
          </a>
          . Until we implement encrypted data, your data is NOT private.
          <br />
          <a 
            href="http://explorer.mendoza.hoodi.arkiv.network/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-green-400 hover:text-green-300 underline"
          >
            Learn more about Arkiv here
          </a>
          .
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          {arkivBuilderMode ? (
            <ArkivQueryTooltip
              query={[
                `Display Name Input`,
                `Stored as: attribute='displayName' on user_profile entity`,
                `Required field for profile creation`
              ]}
              label="Display Name"
            >
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
            </ArkivQueryTooltip>
          ) : (
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
          )}
        </div>

        <div>
          {arkivBuilderMode ? (
            <ArkivQueryTooltip
              query={[
                `Username Input (Real-time Uniqueness Check)`,
                `Query: checkUsernameExists("${username.trim() || '...'}")`,
                `→ type='user_profile', username='${username.trim() || '...'}'`,
                `Returns: All profiles with this username`,
                `Uniqueness: Filters out profiles from same wallet`,
                `Stored as: attribute='username' on user_profile entity`,
                `Note: Username can only be set during onboarding`
              ]}
              label="Username"
            >
              <div className="relative">
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^a-zA-Z0-9_-]/g, '');
                    setUsername(value);
                  }}
                  placeholder="@username (required, 3-20 chars)"
                  required
                  maxLength={20}
                  minLength={3}
                  className={`w-full px-6 py-4 text-lg border-2 rounded-xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-md text-gray-900 dark:text-gray-100 focus:ring-2 transition-all shadow-lg ${
                    usernameError
                      ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                      : username.trim() && !usernameError && !isCheckingUsername
                      ? 'border-green-500 focus:border-green-500 focus:ring-green-500'
                      : 'border-white/30 dark:border-white/20 focus:border-green-500 focus:ring-green-500'
                  }`}
                  disabled={isSubmitting}
                />
                {isCheckingUsername && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <span className="animate-spin text-gray-400">⏳</span>
                  </div>
                )}
                {username.trim() && !usernameError && !isCheckingUsername && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <span className="text-green-500">✓</span>
                  </div>
                )}
              </div>
            </ArkivQueryTooltip>
          ) : (
            <div className="relative">
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^a-zA-Z0-9_-]/g, '');
                  setUsername(value);
                }}
                placeholder="@username (required, 3-20 chars)"
                required
                maxLength={20}
                minLength={3}
                className={`w-full px-6 py-4 text-lg border-2 rounded-xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-md text-gray-900 dark:text-gray-100 focus:ring-2 transition-all shadow-lg ${
                  usernameError
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                    : username.trim() && !usernameError && !isCheckingUsername
                    ? 'border-green-500 focus:border-green-500 focus:ring-green-500'
                    : 'border-white/30 dark:border-white/20 focus:border-green-500 focus:ring-green-500'
                }`}
                disabled={isSubmitting}
              />
              {isCheckingUsername && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <span className="animate-spin text-gray-400">⏳</span>
                </div>
              )}
              {username.trim() && !usernameError && !isCheckingUsername && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <span className="text-green-500">✓</span>
                </div>
              )}
            </div>
          )}
          {usernameError && (
            <p 
              className="text-xs text-red-300 dark:text-red-400 mt-2 drop-shadow-md"
              style={{
                textShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
              }}
            >
              {usernameError}
            </p>
          )}
          {!usernameError && username.trim() && (
            <p 
              className="text-xs text-gray-200 dark:text-gray-300 mt-2 drop-shadow-md"
              style={{
                textShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
              }}
            >
              Username can only be set during onboarding
            </p>
          )}
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
              `handleSubmit()`,
              `Actions:`,
              `1. Validates: displayName (required), username (required, unique)`,
              `2. POST /api/profile { action: 'createProfile', ... }`,
              `   → Checks username uniqueness: checkUsernameExists("${username.trim() || '...'}")`,
              `   → Query: type='user_profile', username='${username.trim() || '...'}'`,
              `   → Filters: Excludes profiles from same wallet`,
              `3. Creates: type='user_profile' entity`,
              `   → Attributes: wallet='${wallet.toLowerCase().slice(0, 8)}...', displayName, username, timezone`,
              `   → Payload: Full profile data (bio, bioShort, etc.)`,
              `   → TTL: 1 year (31536000 seconds)`
            ]}
            label="Continue"
          >
            <button
              type="submit"
              disabled={!displayName.trim() || !username.trim() || !!usernameError || isSubmitting}
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
            disabled={!displayName.trim() || !username.trim() || !!usernameError || isSubmitting}
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

/**
 * Beta invite gate page
 *
 * Simple invite code system to prevent DDOS.
 * Beta code is configured via NEXT_PUBLIC_BETA_INVITE_CODE environment variable.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BackButton } from '@/components/BackButton';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { safeRedirect } from '@/lib/utils/redirect';

export default function BetaPage() {
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const arkivBuilderMode = useArkivBuilderMode();

  // Get beta code from environment variable (client-side accessible)
  const expectedCode = process.env.NEXT_PUBLIC_BETA_INVITE_CODE?.toLowerCase().trim() || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent double-submission
    if (submitting) {
      return;
    }

    if (!expectedCode) {
      setError('Beta access is not configured. Please contact the administrator.');
      return;
    }

    const normalizedCode = inviteCode.toLowerCase().trim();

    if (normalizedCode !== expectedCode) {
      setError('Invalid invite code');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Check if code can be used (hasn't exceeded limit)
      let validateRes: Response;
      try {
        validateRes = await fetch('/api/beta-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: normalizedCode, action: 'validate' }),
        });
      } catch (networkError: any) {
        // Network error (fetch failed entirely - no response)
        console.error('[Beta] Network error during validation:', networkError);
        throw new Error(
          'Network error: Unable to connect to the server. Please check your internet connection and try again.'
        );
      }

      // Check if response is ok before parsing JSON
      if (!validateRes.ok) {
        const errorText = await validateRes.text().catch(() => 'Unknown error');
        throw new Error(
          `Server error (${validateRes.status}): ${errorText || 'Failed to validate beta code'}`
        );
      }

      let validateData: any;
      try {
        validateData = await validateRes.json();
      } catch (jsonError) {
        console.error('[Beta] JSON parse error:', jsonError);
        throw new Error('Invalid response from server. Please try again.');
      }

      if (!validateData.ok) {
        throw new Error(validateData.error || 'Failed to validate beta code');
      }

      if (!validateData.canUse) {
        setError(
          `This beta code has reached its usage limit (${validateData.usage?.limit || 50} uses).`
        );
        setSubmitting(false);
        return;
      }

      // Track usage on Arkiv
      let trackRes: Response;
      try {
        trackRes = await fetch('/api/beta-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: normalizedCode, action: 'track' }),
        });
      } catch (networkError: any) {
        // Network error (fetch failed entirely - no response)
        console.error('[Beta] Network error during tracking:', networkError);
        throw new Error(
          'Network error: Unable to connect to the server. Please check your internet connection and try again.'
        );
      }

      // Check if response is ok before parsing JSON
      if (!trackRes.ok) {
        const errorText = await trackRes.text().catch(() => 'Unknown error');
        throw new Error(
          `Server error (${trackRes.status}): ${errorText || 'Failed to track beta code usage'}`
        );
      }

      let trackData: any;
      try {
        trackData = await trackRes.json();
      } catch (jsonError) {
        console.error('[Beta] JSON parse error:', jsonError);
        throw new Error('Invalid response from server. Please try again.');
      }

      if (!trackData.ok) {
        // Handle specific transaction errors with user-friendly messages
        const errorMessage = trackData.error || 'Failed to track beta code usage';
        if (
          errorMessage.includes('replacement transaction underpriced') ||
          errorMessage.includes('nonce') ||
          errorMessage.includes('underpriced') ||
          errorMessage.includes('still processing')
        ) {
          throw new Error(
            'Transaction is still processing from a previous request. Please wait a moment and try again.'
          );
        }
        throw new Error(errorMessage);
      }

      // Store invite code and access key for future checks
      const accessKey = trackData.key; // Beta code usage entity key

      // Set cookies and localStorage for server-side middleware checks
      // Handle privacy-focused browsers (DuckDuckGo, etc.) that may block these
      if (typeof window !== 'undefined') {
        try {
          // Set cookies (httpOnly will be handled by server if needed, but for now client-side is fine)
          document.cookie = `beta_access_code=${normalizedCode}; path=/; max-age=31536000; SameSite=Lax`;
          document.cookie = `beta_access_key=${accessKey}; path=/; max-age=31536000; SameSite=Lax`;
        } catch (cookieError) {
          // Cookies may be blocked by privacy settings - log but don't fail
          console.warn(
            '[Beta] Failed to set cookies (may be blocked by privacy settings):',
            cookieError
          );
        }

        try {
          // Also keep in localStorage for client-side checks
          localStorage.setItem('beta_invite_code', normalizedCode);
          localStorage.setItem('beta_access_key', accessKey);
        } catch (storageError) {
          // localStorage may be blocked by privacy settings - log but don't fail
          console.warn(
            '[Beta] Failed to set localStorage (may be blocked by privacy settings):',
            storageError
          );
        }
      }

      // Redirect to auth or return URL
      // Validate redirect param to prevent routing to "null" (URLSearchParams.get() returns null)
      const params = new URLSearchParams(window.location.search);
      const redirectParam = params.get('redirect');
      const redirectUrl = safeRedirect(redirectParam, '/auth');

      // Development assertion to catch invalid redirects
      if (process.env.NODE_ENV === 'development' && redirectUrl === 'null') {
        console.error('[Beta] Invalid redirect detected: "null"', {
          redirectParam,
          search: window.location.search,
        });
      }

      router.push(redirectUrl);
    } catch (err: any) {
      console.error('[Beta] Beta code error:', err);
      // Provide user-friendly error message
      const errorMessage = err.message || 'Failed to process beta code';
      setError(errorMessage);
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen p-8 text-gray-900 dark:text-gray-100">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <BackButton href="/" />
        </div>

        <h1 className="mb-6 text-3xl font-bold text-gray-900 dark:text-gray-50">
          Welcome to p2pmentor Beta
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => {
                setInviteCode(e.target.value);
                setError('');
              }}
              placeholder="Invite code"
              title="Enter your invite code to continue"
              className="focus:ring-[var(--accent-color)]/20 w-full rounded-lg border-2 border-[var(--border-color)] bg-white px-4 py-3 text-base text-gray-900 transition-colors focus:border-[var(--accent-color)] focus:outline-none focus:ring-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/20"
            />
          </div>

          {error && <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}

          <ArkivQueryTooltip
            query={[
              `getBetaCodeUsage(code='${inviteCode || '...'}')`,
              `type='beta_code_usage', code='{code}'`,
              `trackBetaCodeUsage(code='${inviteCode || '...'}')`,
              `Creates: type='beta_code_usage'`,
            ]}
            label="Beta Code Queries"
          >
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-[var(--accent-color)] px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-700 dark:focus:ring-emerald-500"
            >
              {submitting ? 'Processing...' : 'Unlock Beta'}
            </button>
          </ArkivQueryTooltip>
        </form>
      </div>
    </main>
  );
}

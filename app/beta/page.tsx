/**
 * Beta invite gate page
 * 
 * Simple invite code system to prevent DDOS.
 * Beta code is configured via NEXT_PUBLIC_BETA_INVITE_CODE environment variable.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BackButton } from '@/components/BackButton';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function BetaPage() {
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  // Get beta code from environment variable (client-side accessible)
  const expectedCode = process.env.NEXT_PUBLIC_BETA_INVITE_CODE?.toLowerCase().trim() || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
      const validateRes = await fetch('/api/beta-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: normalizedCode, action: 'validate' }),
      });

      const validateData = await validateRes.json();
      
      if (!validateData.ok) {
        throw new Error(validateData.error || 'Failed to validate beta code');
      }

      if (!validateData.canUse) {
        setError(`This beta code has reached its usage limit (${validateData.usage?.limit || 50} uses).`);
        setSubmitting(false);
        return;
      }

      // Track usage on Arkiv
      const trackRes = await fetch('/api/beta-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: normalizedCode, action: 'track' }),
      });

      const trackData = await trackRes.json();
      
      if (!trackData.ok) {
        throw new Error(trackData.error || 'Failed to track beta code usage');
      }

      // Store invite code and access key for future checks
      const accessKey = trackData.key; // Beta code usage entity key

      // Set cookies for server-side middleware checks
      // Cookies are more secure than localStorage for server-side validation
      if (typeof window !== 'undefined') {
        // Set cookies (httpOnly will be handled by server if needed, but for now client-side is fine)
        document.cookie = `beta_access_code=${normalizedCode}; path=/; max-age=31536000; SameSite=Lax`;
        document.cookie = `beta_access_key=${accessKey}; path=/; max-age=31536000; SameSite=Lax`;
        
        // Also keep in localStorage for client-side checks
        localStorage.setItem('beta_invite_code', normalizedCode);
        localStorage.setItem('beta_access_key', accessKey);
      }
      
      // Redirect to auth or return URL
      const redirectUrl = new URLSearchParams(window.location.search).get('redirect') || '/auth';
      router.push(redirectUrl);
    } catch (err: any) {
      console.error('Beta code error:', err);
      setError(err.message || 'Failed to process beta code');
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen text-gray-900 dark:text-gray-100 p-8">
      <ThemeToggle />
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <BackButton href="/" />
        </div>
        
        <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-50">
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
              className="w-full px-4 py-3 text-base border-2 rounded-lg 
                       bg-white dark:bg-gray-800 
                       text-gray-900 dark:text-gray-100
                       border-[var(--border-color)] dark:border-gray-600
                       focus:border-[var(--accent-color)] dark:focus:border-emerald-500
                       focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]/20 dark:focus:ring-emerald-500/20
                       transition-colors"
            />
          </div>
          
          {error && (
            <p className="text-red-600 dark:text-red-400 text-sm font-medium">
              {error}
            </p>
          )}
          
          <button
            type="submit"
            disabled={submitting}
            className="w-full px-6 py-3 text-base font-semibold rounded-lg
                     bg-[var(--accent-color)] dark:bg-emerald-600
                     text-white
                     hover:bg-[var(--accent-hover)] dark:hover:bg-emerald-700
                     focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] dark:focus:ring-emerald-500 focus:ring-offset-2
                     transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Processing...' : 'Unlock Beta'}
          </button>
        </form>
      </div>
    </main>
  );
}


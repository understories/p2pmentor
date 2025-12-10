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
  const router = useRouter();

  // Get beta code from environment variable (client-side accessible)
  const expectedCode = process.env.NEXT_PUBLIC_BETA_INVITE_CODE?.toLowerCase().trim() || '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!expectedCode) {
      setError('Beta access is not configured. Please contact the administrator.');
      return;
    }
    
    if (inviteCode.toLowerCase().trim() === expectedCode) {
      // Store invite code in session/localStorage for future checks
      if (typeof window !== 'undefined') {
        localStorage.setItem('beta_invite_code', inviteCode);
      }
      router.push('/auth');
    } else {
      setError('Invalid invite code');
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
                       border-gray-300 dark:border-gray-600
                       focus:border-blue-500 dark:focus:border-emerald-500
                       focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:ring-emerald-500/20
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
            className="w-full px-6 py-3 text-base font-semibold rounded-lg
                     bg-blue-600 dark:bg-emerald-600
                     text-white
                     hover:bg-blue-700 dark:hover:bg-emerald-700
                     focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-emerald-500 focus:ring-offset-2
                     transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Unlock Beta
          </button>
        </form>
      </div>
    </main>
  );
}


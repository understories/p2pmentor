/**
 * Network Path Step Component
 *
 * Redirects to network page and tracks exploration
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setOnboardingBypass } from '@/lib/onboarding/access';

interface NetworkPathStepProps {
  wallet: string;
  onComplete: () => void;
  onError: (error: Error) => void;
}

export function NetworkPathStep({ wallet, onComplete, onError }: NetworkPathStepProps) {
  const router = useRouter();

  useEffect(() => {
    async function trackExploration() {
      try {
        // Create onboarding event to track network exploration
        // Uses server-side signing wallet (no MetaMask popup)
        const res = await fetch('/api/onboarding-events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wallet,
            eventType: 'network_explored',
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to track network exploration');
        }
      } catch (err) {
        console.error('Failed to track network exploration:', err);
        // Don't block user if tracking fails - this is non-critical analytics
      }
    }

    trackExploration();

    // Set bypass flag so network page allows access
    setOnboardingBypass(true);

    // Redirect to network page
    router.push('/network');

    // Call onComplete after a short delay (user will be on network page)
    setTimeout(() => {
      onComplete();
    }, 1000);
  }, [wallet, router, onComplete]);

  return (
    <div className="animate-fade-in space-y-8 text-center">
      <div
        className="mb-4 text-6xl"
        style={{
          filter: 'drop-shadow(0 0 20px rgba(255, 255, 255, 0.6))',
        }}
      >
        🌐
      </div>
      <h2
        className="mb-4 text-4xl font-bold text-white drop-shadow-lg dark:text-white md:text-5xl"
        style={{
          textShadow: '0 0 20px rgba(255, 255, 255, 0.5), 0 0 40px rgba(255, 255, 255, 0.3)',
        }}
      >
        Exploring the Network
      </h2>
      <p
        className="mb-8 text-lg text-gray-200 drop-shadow-md dark:text-gray-300"
        style={{
          textShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
        }}
      >
        Redirecting you to the network page...
      </p>
      <div className="animate-pulse">
        <div className="inline-block h-8 w-8 rounded-full border-4 border-green-500 border-t-transparent"></div>
      </div>
    </div>
  );
}

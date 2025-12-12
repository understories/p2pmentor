/**
 * Network Path Step Component
 * 
 * Redirects to network page and tracks exploration
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createOnboardingEventClient } from '@/lib/arkiv/onboardingEvent';
import { getWalletClient } from '@/lib/wallet/getWalletClient';
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
        const walletClient = await getWalletClient(wallet as `0x${string}`);
        // We need account address for createOnboardingEventClient
        // For now, use wallet as account (works for MetaMask)
        await createOnboardingEventClient({
          wallet,
          eventType: 'network_explored',
          account: wallet as `0x${string}`,
        });
      } catch (err) {
        console.error('Failed to track network exploration:', err);
        // Don't block user if tracking fails
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
    <div className="space-y-8 text-center animate-fade-in">
      <div 
        className="text-6xl mb-4"
        style={{
          filter: 'drop-shadow(0 0 20px rgba(255, 255, 255, 0.6))',
        }}
      >
        🌐
      </div>
      <h2 
        className="text-4xl md:text-5xl font-bold mb-4 text-white dark:text-white drop-shadow-lg"
        style={{
          textShadow: '0 0 20px rgba(255, 255, 255, 0.5), 0 0 40px rgba(255, 255, 255, 0.3)',
        }}
      >
        Exploring the Network
      </h2>
      <p 
        className="text-gray-200 dark:text-gray-300 text-lg mb-8 drop-shadow-md"
        style={{
          textShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
        }}
      >
        Redirecting you to the network page...
      </p>
      <div className="animate-pulse">
        <div className="inline-block w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full"></div>
      </div>
    </div>
  );
}

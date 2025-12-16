/**
 * Authentication page
 * 
 * Allows users to connect with MetaMask or use example wallet login.
 * 
 * Reference: refs/mentor-graph/pages/index.tsx
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { connectWallet } from '@/lib/auth/metamask';
import { mendoza } from '@arkiv-network/sdk/chains';
import { BackButton } from '@/components/BackButton';
import { ThemeToggle } from '@/components/ThemeToggle';
import { setWalletType } from '@/lib/wallet/getWalletClient';

export default function AuthPage() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [loadingExample, setLoadingExample] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [addingNetwork, setAddingNetwork] = useState(false);
  const router = useRouter();

  // Check if user has already passed invite gate
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const inviteCode = localStorage.getItem('beta_invite_code');
      if (!inviteCode) {
        router.push('/beta');
      }
    }
  }, [router]);

  // Set mounted state for client-side rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleMetaMaskConnect = async () => {
    setIsConnecting(true);
    setError('');
    
    try {
      const address = await connectWallet();
      
      // Store profile wallet address in localStorage for session persistence
      // This is the wallet address used as the 'wallet' attribute on entities (profiles, asks, offers)
      // The global Arkiv signing wallet (from ARKIV_PRIVATE_KEY) signs transactions, but entities are tied to this profile wallet
      if (typeof window !== 'undefined') {
        localStorage.setItem('wallet_address', address);
        // Store wallet type for unified wallet client getter
        setWalletType(address, 'metamask');
      }
      
      // Check if user has profile for this profile wallet - redirect to onboarding if not
      // Only create beta access record for NEW users (level === 0) to avoid double-counting
      import('@/lib/onboarding/state').then(({ calculateOnboardingLevel }) => {
        calculateOnboardingLevel(address).then(level => {
          if (level === 0) {
            // No profile for this profile wallet - new user, create beta access record
            // This tracks which profile wallets have used which beta codes (only for new users)
            const betaCode = localStorage.getItem('beta_invite_code');
            if (betaCode) {
              // Create beta access record asynchronously (don't block auth flow)
              fetch('/api/beta-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  code: betaCode,
                  action: 'createAccess',
                  wallet: address.toLowerCase(), // Use profile wallet, not signing wallet
                }),
              }).catch(err => {
                // Don't block auth flow if beta access creation fails
                console.warn('[auth] Failed to create beta access record:', err);
              });
            }
            // Redirect to onboarding for new users
            router.push('/onboarding');
          } else {
            // Has profile - existing user, don't create beta access (already counted)
            router.push('/me');
          }
        }).catch(() => {
          // On error, default to /me (don't block on calculation failure)
          router.push('/me');
        });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
      setIsConnecting(false);
    }
  };

  const handleAddMendozaNetwork = async () => {
    if (!window.ethereum) {
      setError('MetaMask not installed');
      return;
    }

    setAddingNetwork(true);
    setError('');

    try {
      const chainIdHex = `0x${mendoza.id.toString(16)}`;

      // Always call wallet_addEthereumChain directly - MetaMask will handle:
      // - If network doesn't exist: Show add network prompt
      // - If network already exists: Show appropriate message or switch to it
      // This ensures MetaMask always opens and handles the state appropriately
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: chainIdHex,
            chainName: mendoza.name,
            nativeCurrency: mendoza.nativeCurrency,
            rpcUrls: mendoza.rpcUrls.default.http,
            blockExplorerUrls: [mendoza.blockExplorers.default.url],
          },
        ],
      });

      // If we get here, the network was added or already exists
      // The app should continue to work in both cases
    } catch (err: any) {
      // Handle errors gracefully - MetaMask will handle the network state
      // Error code 4001 = User rejected the request (user cancelled)
      if (err?.code === 4001) {
        // User cancelled - this is fine, just clear the error
        setError('');
      } else {
        // Other errors: network already exists, or other issues
        // MetaMask handles "already exists" cases - we don't need to show an error
        // The network is either already added (good) or was just added (good)
        // Only show error for truly unexpected issues
        const errorMessage = err?.message || '';
        const errorCode = err?.code;

        // Don't show error if:
        // - Network already exists (various error messages/codes)
        // - User cancelled (already handled above)
        // - Any error that suggests the network is already configured
        if (errorCode !== 4001 &&
            !errorMessage.toLowerCase().includes('already') &&
            !errorMessage.toLowerCase().includes('exists') &&
            !errorMessage.toLowerCase().includes('duplicate')) {
          // Only show unexpected errors
          setError(errorMessage || 'Failed to add Mendoza testnet');
        } else {
          // Network is already added or user cancelled - clear error
          setError('');
        }
      }
    } finally {
      setAddingNetwork(false);
    }
  };

  const handleExampleWallet = async () => {
    try {
      setLoadingExample(true);
      setError('');
      const res = await fetch('/api/wallet');
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 503) {
          throw new Error('Example wallet not available. Please set ARKIV_PRIVATE_KEY in your .env file, or use MetaMask to connect.');
        }
        throw new Error(errorData.error || 'Failed to fetch example wallet');
      }
      const data = await res.json();
      if (!data.address) {
        throw new Error('No example wallet available');
      }
      // Store profile wallet address in localStorage for session persistence
      // This is the wallet address used as the 'wallet' attribute on entities (profiles, asks, offers)
      // The global Arkiv signing wallet (from ARKIV_PRIVATE_KEY) signs transactions, but entities are tied to this profile wallet
      if (typeof window !== 'undefined') {
        localStorage.setItem('wallet_address', data.address);
      }
      // Check if user has profile for this profile wallet - redirect to onboarding if not
      // Only create beta access record for NEW users (level === 0) to avoid double-counting
      import('@/lib/onboarding/state').then(({ calculateOnboardingLevel }) => {
        calculateOnboardingLevel(data.address).then(level => {
          if (level === 0) {
            // No profile for this profile wallet - new user, create beta access record
            // This tracks which profile wallets have used which beta codes (only for new users)
            const betaCode = localStorage.getItem('beta_invite_code');
            if (betaCode) {
              // Create beta access record asynchronously (don't block auth flow)
              fetch('/api/beta-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  code: betaCode,
                  action: 'createAccess',
                  wallet: data.address.toLowerCase(), // Use profile wallet, not signing wallet
                }),
              }).catch(err => {
                // Don't block auth flow if beta access creation fails
                console.warn('[auth] Failed to create beta access record:', err);
              });
            }
            // Redirect to onboarding for new users
            router.push('/onboarding');
          } else {
            // Has profile - existing user, don't create beta access (already counted)
            router.push('/me');
          }
        }).catch(() => {
          // On error, default to /me (don't block on calculation failure)
          router.push('/me');
        });
      });
    } catch (err: any) {
      console.error('Failed to load example wallet:', err);
      setError(err.message || 'Failed to load example wallet');
      setLoadingExample(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 text-gray-900 dark:text-gray-100">
      <ThemeToggle />
      <div className="max-w-md w-full bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="mb-4">
          <BackButton href="/beta" />
        </div>
        <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">
          Connect to p2pmentor
        </h1>
        <p className="text-base text-gray-600 dark:text-gray-400 mb-6">
          Choose your authentication method:
        </p>

        {/* Add Mendoza Testnet Button */}
        {mounted && window.ethereum && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-300 mb-2">
              <strong>First time?</strong> Add Mendoza testnet to your wallet:
            </p>
            <button
              onClick={handleAddMendozaNetwork}
              disabled={addingNetwork}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {addingNetwork ? 'Adding Network...' : 'Add Mendoza Testnet to Wallet'}
            </button>
          </div>
        )}

        {error && (
          <div className="p-4 mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-4 mb-6">
          <button
            onClick={handleMetaMaskConnect}
            disabled={isConnecting || loadingExample}
            className="w-full px-6 py-3 text-base font-medium text-white bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-500 rounded-lg transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:bg-green-500 dark:disabled:hover:bg-green-600"
          >
            {isConnecting ? 'Connecting...' : 'Connect with MetaMask'}
          </button>

          {mounted && (
            <>
              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
                <span className="text-sm text-gray-500 dark:text-gray-400">or</span>
                <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
              </div>

              <div className="w-full px-6 py-3 text-base font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg opacity-60 cursor-not-allowed text-center">
                Passkey Login (Coming Soon)
              </div>
            </>
          )}

          <div className="flex items-center gap-3 my-2">
            <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
            <span className="text-sm text-gray-500 dark:text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
          </div>

          <button
            onClick={handleExampleWallet}
            disabled={isConnecting || loadingExample}
            className="w-full px-6 py-3 text-base font-medium text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:bg-gray-100 dark:disabled:hover:bg-gray-700"
          >
            {loadingExample ? 'Loading...' : 'Log in with Example Wallet'}
          </button>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 text-center">
            Try the demo without MetaMask
          </p>
        </div>

        <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg opacity-60 hover:opacity-100 transition-opacity duration-300">
          <strong className="text-yellow-800 dark:text-yellow-300 text-sm font-semibold block mb-2">
            ⚠️ Beta Environment
          </strong>
          <p className="mt-2 text-sm text-yellow-700 dark:text-yellow-400 leading-relaxed">
            This is a beta environment on{' '}
            <a
              href="https://mendoza.hoodi.arkiv.network"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-800 dark:text-yellow-300 underline hover:text-yellow-900 dark:hover:text-yellow-200"
            >
              Mendoza testnet
            </a>. Do not use a wallet containing real funds.
          </p>
          <p className="mt-2 text-sm text-yellow-700 dark:text-yellow-400 leading-relaxed">
            Blockchain data is immutable and transparent by design. All data inputted on this beta is viewable on the{' '}
            <a
              href="https://explorer.mendoza.hoodi.arkiv.network"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-800 dark:text-yellow-300 underline hover:text-yellow-900 dark:hover:text-yellow-200"
            >
              Arkiv explorer
            </a>.
          </p>
        </div>

        {/* Privacy & Data Link */}
        <div className="mt-4 flex justify-center">
          <a
            href="/docs/philosophy/tracking-and-privacy"
            className="group inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
            title="Understand and verify what p2pmentor tracks about users and usage"
          >
            <span className="text-base" role="img" aria-label="Privacy">🥷</span>
            <span className="underline">Privacy & Data</span>
          </a>
        </div>
      </div>
    </main>
  );
}


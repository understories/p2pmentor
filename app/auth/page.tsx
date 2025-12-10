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
import { BackButton } from '@/components/BackButton';
import { ThemeToggle } from '@/components/ThemeToggle';
import { PasskeyLoginButton } from '@/components/auth/PasskeyLoginButton';
import { PasskeyResetButton } from '@/components/auth/PasskeyResetButton';
import { usePasskeyLogin } from '@/lib/auth/passkeyFeatureFlags';
import { setWalletType } from '@/lib/wallet/getWalletClient';

export default function AuthPage() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [loadingExample, setLoadingExample] = useState(false);
  const [error, setError] = useState('');
  const [passkeyEnabled, setPasskeyEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
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

  // Check if passkey login is enabled (client-side only to avoid hydration issues)
  useEffect(() => {
    setMounted(true);
    const checkPasskeyEnabled = async () => {
      const enabled = await usePasskeyLogin();
      setPasskeyEnabled(enabled);
    };
    checkPasskeyEnabled();
  }, []);

  const handleMetaMaskConnect = async () => {
    setIsConnecting(true);
    setError('');
    
    try {
      const address = await connectWallet();
      
      // Store wallet address in localStorage for session persistence
      if (typeof window !== 'undefined') {
        localStorage.setItem('wallet_address', address);
        // Store wallet type for unified wallet client getter
        setWalletType(address, 'metamask');
      }
      
      router.push('/me');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
      setIsConnecting(false);
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
      // Store wallet address in localStorage for session persistence
      if (typeof window !== 'undefined') {
        localStorage.setItem('wallet_address', data.address);
      }
      // Redirect to dashboard
      router.push('/me');
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

          {mounted && passkeyEnabled && (
            <>
              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
                <span className="text-sm text-gray-500 dark:text-gray-400">or</span>
                <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
              </div>

              <PasskeyLoginButton
                onSuccess={(address) => {
                  router.push('/me');
                }}
                onError={(err) => {
                  setError(err.message);
                }}
              />
              
              {/* Reset button for troubleshooting */}
              <div className="mt-3 relative">
                <details 
                  className="text-sm group"
                  open={detailsOpen}
                  onToggle={(e) => setDetailsOpen((e.target as HTMLDetailsElement).open)}
                >
                  <summary className="relative cursor-pointer text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 inline-block">
                    Having issues? Reset passkeys
                  </summary>
                  <div className="mt-2">
                    <PasskeyResetButton
                      onReset={() => {
                        setError('');
                        // Reload page to refresh state
                        window.location.reload();
                      }}
                    />
                  </div>
                </details>
                {/* Tooltip - always visible when details is open, or on hover when closed */}
                <div 
                  className={`absolute right-full top-1/2 -translate-y-1/2 mr-3 w-80 p-3 bg-white/95 dark:bg-gray-800 backdrop-blur-sm text-gray-900 dark:text-white text-sm rounded-lg shadow-lg z-10 border border-gray-200 dark:border-gray-700 pointer-events-none transition-opacity duration-300 ${
                    detailsOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  Don't worry - although we have no central server, you can regrow your profile with historical blockchain data!
                </div>
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
          {mounted && passkeyEnabled && (
            <p className="mt-2 text-sm text-yellow-700 dark:text-yellow-400 leading-relaxed">
              <strong>Passkey Wallet:</strong> Powered by the Fusaka upgrade ({' '}
              <a
                href="https://eips.ethereum.org/EIPS/eip-7951"
                target="_blank"
                rel="noopener noreferrer"
                className="text-yellow-800 dark:text-yellow-300 underline hover:text-yellow-900 dark:hover:text-yellow-200"
              >
                EIP-7951
              </a>
              {' '}), which enables native secp256r1 signature verification for efficient passkey authentication. This is experimental. You can reset your passkey wallet at any time. All passkey data is stored locally and can be cleared. MetaMask and Example Wallet remain available as alternatives.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}


/**
 * Authentication page
 *
 * Allows users to connect with MetaMask or use example wallet login.
 *
 * Reference: refs/mentor-graph/pages/index.tsx
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { connectWallet } from '@/lib/auth/metamask';
import { connectWalletConnect } from '@/lib/auth/walletconnect';
import { mendoza } from '@arkiv-network/sdk/chains';
import { BackButton } from '@/components/BackButton';
import { setWalletType } from '@/lib/wallet/getWalletClient';
import { isMobileBrowser, isMetaMaskBrowser, isMetaMaskAvailable, getMobilePlatform } from '@/lib/auth/mobile-detection';
import { openInMetaMaskBrowser, getMetaMaskInstallUrl } from '@/lib/auth/deep-link';
import { ArkivQueryTooltip } from '@/components/ArkivQueryTooltip';
import { useArkivBuilderMode } from '@/lib/hooks/useArkivBuilderMode';
import { PasskeyLoginButton } from '@/components/auth/PasskeyLoginButton';

export default function AuthPage() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnectingWalletConnect, setIsConnectingWalletConnect] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [addingNetwork, setAddingNetwork] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isMetaMaskMobileBrowser, setIsMetaMaskMobileBrowser] = useState(false);
  const [hasMetaMask, setHasMetaMask] = useState(false);
  const [openingMetaMask, setOpeningMetaMask] = useState(false);
  const openingTimerRef = useRef<number | null>(null);
  const router = useRouter();
  const arkivBuilderMode = useArkivBuilderMode();

  // Review mode state
  const [isReviewModeEnabled, setIsReviewModeEnabled] = useState(false);
  const [reviewModePassword, setReviewModePassword] = useState('');
  const [reviewModeWallet, setReviewModeWallet] = useState<string | null>(null);
  const [isActivatingReviewMode, setIsActivatingReviewMode] = useState(false);
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);

  // Check if WalletConnect is enabled via feature flag
  const isWalletConnectEnabled = typeof window !== 'undefined' &&
    process.env.NEXT_PUBLIC_WALLETCONNECT_ENABLED === 'true';

  // CRITICAL: Clear wallet_address on /auth mount to prevent auto-login
  // /auth should ALWAYS require explicit user action to connect wallet
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Clear wallet address to force explicit connection
      localStorage.removeItem('wallet_address');
      console.log('[Auth Page] Cleared wallet_address to prevent auto-login');
    }
  }, []);

  // Check if user has already passed invite gate
  // IMPORTANT: Normalize encoded pathname FIRST before any redirect logic
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Self-heal: fix encoded slash in host pattern (e.g., "p2pmentor.com%2fauth")
      // This can happen if MetaMask doesn't decode %2F in the universal link
      const href = window.location.href.toLowerCase();
      if (href.includes('.com%2f') || href.includes('.xyz%2f')) {
        const fixedHref = window.location.href.replace(/%2f/gi, '/');
        window.location.href = fixedHref;
        return; // Let the redirect happen, will re-run this effect
      }

      // Normalize encoded pathname BEFORE any other logic (prevents redirect loops)
      // Only normalize the specific leading "%2F" case ("/%2Fauth" -> "/auth")
      // Case-insensitive regex handles both %2F and %2f
      const currentPath = window.location.pathname;
      const normalizedPath = currentPath.replace(/^\/%2F/i, '/');

      if (normalizedPath !== currentPath) {
        window.history.replaceState({}, '', normalizedPath + window.location.search);
        console.log('[Auth Page] Fixed encoded URL from MetaMask redirect', {
          originalPath: currentPath,
          normalizedPath,
        });
      }

      // Detection tripwire: warn if encoded pathname still exists after normalization
      if (window.location.pathname.toLowerCase().startsWith('/%2f')) {
        console.warn('[Pathname encoded]', window.location.href);
      }

      // Now check beta access (after normalization)
      const inviteCode = localStorage.getItem('beta_invite_code');
      if (!inviteCode) {
        router.push('/beta');
      }
    }
  }, [router]);

  // Set mounted state for client-side rendering
  useEffect(() => {
    setMounted(true);
    // Detect mobile and MetaMask availability
    if (typeof window !== 'undefined') {
      const isMobileDetected = isMobileBrowser();
      const isMetaMaskBrowserDetected = isMetaMaskBrowser();
      const hasMetaMaskDetected = isMetaMaskAvailable();

      console.log('[Auth Page] Initialization', {
        isMobile: isMobileDetected,
        isMetaMaskBrowser: isMetaMaskBrowserDetected,
        hasMetaMask: hasMetaMaskDetected,
        currentUrl: window.location.href,
        referrer: document.referrer,
        userAgent: window.navigator.userAgent,
      });

      setIsMobile(isMobileDetected);
      setIsMetaMaskMobileBrowser(isMetaMaskBrowserDetected);
      setHasMetaMask(hasMetaMaskDetected);

      // Check if we're returning from a MetaMask redirect on mobile
      // MetaMask SDK redirects back to the browser after wallet selection
      // Clean up URL parameters if present
      const urlParams = new URLSearchParams(window.location.search);
      const hasMetaMaskParam = urlParams.has('metamask');
      const hasEthereumParam = urlParams.has('ethereum');
      const hasRedirectParam = urlParams.has('redirect');

      if (hasMetaMaskParam || hasEthereumParam || hasRedirectParam) {
        console.log('[Auth Page] Detected redirect parameters', {
          hasMetaMaskParam,
          hasEthereumParam,
          hasRedirectParam,
          allParams: Object.fromEntries(urlParams.entries()),
          currentUrl: window.location.href,
        });

        // Clear the query params to clean up the URL
        // The SDK should handle the connection automatically, but if not,
        // the user can click "Connect" again and it should work
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
        console.log('[Auth Page] Cleaned URL to:', cleanUrl);
      }
    }
  }, []);

  // Clear timeout on unmount to prevent state update warnings
  useEffect(() => {
    return () => {
      if (openingTimerRef.current) {
        window.clearTimeout(openingTimerRef.current);
      }
    };
  }, []);

  // Cancel banner instantly if page goes hidden (MetaMask opened successfully)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setOpeningMetaMask(false);
        if (openingTimerRef.current) {
          window.clearTimeout(openingTimerRef.current);
          openingTimerRef.current = null;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleMetaMaskConnect = async () => {
    // If review mode is enabled, password must be verified first
    if (isReviewModeEnabled && !isPasswordVerified) {
      setError('Please verify password first');
      return;
    }

    // Mobile Safari/Chrome won't have window.ethereum even if MetaMask is installed.
    // Redirect users into MetaMask's in-app browser instead.
    if (mounted && isMobile && !isMetaMaskMobileBrowser) {
      setOpeningMetaMask(true);

      // Clear any existing timeout
      if (openingTimerRef.current) {
        window.clearTimeout(openingTimerRef.current);
      }
      // Reset after 4 seconds in case OS blocks the redirect
      openingTimerRef.current = window.setTimeout(() => {
        setOpeningMetaMask(false);
        openingTimerRef.current = null;
      }, 4000);

      // Pass intent (path), not transient browser state (window.location.href)
      // This avoids issues where window.location.href is "null" or "about:blank"
      // during navigation on mobile browsers
      openInMetaMaskBrowser('/auth');
      return;
    }

    console.log('[Auth Page] handleMetaMaskConnect called', {
      currentUrl: typeof window !== 'undefined' ? window.location.href : 'N/A',
      isMobile,
      isMetaMaskMobileBrowser,
      hasMetaMask,
      isReviewModeEnabled,
      isPasswordVerified,
    });

    setIsConnecting(true);
    setError('');

    try {
      // For review mode, always force account selection by clearing stored wallet
      if (isReviewModeEnabled && typeof window !== 'undefined') {
        localStorage.removeItem('wallet_address');
      }

      const address = await connectWallet();
      console.log('[Auth Page] Wallet connected successfully', {
        address: `${address.substring(0, 6)}...${address.substring(address.length - 4)}`,
      });

      // Store profile wallet address in localStorage for session persistence
      // This is the wallet address used as the 'wallet' attribute on entities (profiles, asks, offers)
      // The global Arkiv signing wallet (from ARKIV_PRIVATE_KEY) signs transactions, but entities are tied to this profile wallet
      if (typeof window !== 'undefined') {
        localStorage.setItem('wallet_address', address);
        // Store wallet type for unified wallet client getter
        setWalletType(address, 'metamask');
        // Store connection method for reconnection handling
        localStorage.setItem('wallet_connection_method', 'metamask');
      }

      // If review mode is enabled and password verified, issue grant and route to review onboarding
      if (isReviewModeEnabled && isPasswordVerified) {
        setReviewModeWallet(address);
        await handleReviewModeActivate();
        return; // handleReviewModeActivate will handle routing
      }

      // Check Arkiv for review mode grant and profile
      // Routing policy: profile exists → /me, else if grant exists → /review, else → onboarding
      const { getLatestValidReviewModeGrant } = await import('@/lib/arkiv/reviewModeGrant');
      const { getProfileByWallet } = await import('@/lib/arkiv/profile');

      const [grant, profile] = await Promise.all([
        getLatestValidReviewModeGrant(address),
        getProfileByWallet(address),
      ]);

      if (profile) {
        // Profile exists - normal user
        router.push('/me');
      } else if (grant) {
        // Review mode grant exists - route to review onboarding
        router.push('/review');
      } else {
        // Normal flow - check onboarding level
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
      }
    } catch (err) {
      console.error('[Auth Page] Connection error', {
        error: err instanceof Error ? err.message : 'Unknown error',
        errorObject: err,
        stack: err instanceof Error ? err.stack : undefined,
        currentUrl: typeof window !== 'undefined' ? window.location.href : 'N/A',
      });

      // Provide clear error messages based on error type
      let errorMessage = 'Failed to connect wallet';
      if (err instanceof Error) {
        if (err.message.includes('cancelled') || err.message.includes('rejected')) {
          errorMessage = 'Connection cancelled. Please try again when ready.';
        } else if (err.message.includes('not installed')) {
          errorMessage = 'MetaMask not found. Please install MetaMask or use the mobile app.';
        } else {
          errorMessage = err.message;
        }
      }
      setError(errorMessage);
      setIsConnecting(false);
      setIsActivatingReviewMode(false);
    }
  };

  const handleWalletConnectConnect = async () => {
    // Guard: Check feature flag
    if (!isWalletConnectEnabled) {
      setError('WalletConnect is disabled');
      return;
    }

    // If review mode is enabled, password must be verified first
    if (isReviewModeEnabled && !isPasswordVerified) {
      setError('Please verify password first');
      return;
    }

    setIsConnectingWalletConnect(true);
    setError('');

    try {
      // For review mode, always force account selection by clearing stored wallet
      if (isReviewModeEnabled && typeof window !== 'undefined') {
        localStorage.removeItem('wallet_address');
      }
      // If user is already connected with MetaMask for the same address, disconnect first
      // This prevents conflicts when switching connection methods
      if (typeof window !== 'undefined') {
        const existingWallet = localStorage.getItem('wallet_address');
        const existingWalletType = existingWallet
          ? localStorage.getItem(`wallet_type_${existingWallet.toLowerCase()}`)
          : null;

        if (existingWalletType === 'metamask' && window.ethereum) {
          console.log('[Auth Page] Disconnecting existing MetaMask connection before WalletConnect');
          try {
            const { disconnectWallet } = await import('@/lib/auth/metamask');
            await disconnectWallet();
            // Clear wallet type to prevent conflicts
            if (existingWallet) {
              localStorage.removeItem(`wallet_type_${existingWallet.toLowerCase()}`);
            }
          } catch (disconnectError) {
            // Non-critical - continue with WalletConnect even if MetaMask disconnect fails
            console.warn('[Auth Page] Failed to disconnect MetaMask (non-critical):', disconnectError);
            // Still clear wallet type to prevent conflicts
            if (existingWallet) {
              localStorage.removeItem(`wallet_type_${existingWallet.toLowerCase()}`);
            }
          }
        }
      }

      const address = await connectWalletConnect();
      console.log('[Auth Page] WalletConnect connected successfully', {
        address: `${address.substring(0, 6)}...${address.substring(address.length - 4)}`,
      });

      // Store profile wallet address in localStorage for session persistence
      if (typeof window !== 'undefined') {
        localStorage.setItem('wallet_address', address);
        // Store wallet type for unified wallet client getter
        setWalletType(address, 'walletconnect');
        // Store connection method for reconnection handling
        localStorage.setItem('wallet_connection_method', 'walletconnect');
      }

      // If review mode is enabled and password verified, issue grant and route to review onboarding
      if (isReviewModeEnabled && isPasswordVerified) {
        setReviewModeWallet(address);
        await handleReviewModeActivate();
        return; // handleReviewModeActivate will handle routing
      }

      // Check Arkiv for review mode grant and profile
      // Routing policy: profile exists → /me, else if grant exists → /review, else → onboarding
      const { getLatestValidReviewModeGrant } = await import('@/lib/arkiv/reviewModeGrant');
      const { getProfileByWallet } = await import('@/lib/arkiv/profile');

      const [grant, profile] = await Promise.all([
        getLatestValidReviewModeGrant(address),
        getProfileByWallet(address),
      ]);

      if (profile) {
        // Profile exists - normal user
        router.push('/me');
      } else if (grant) {
        // Review mode grant exists - route to review onboarding
        router.push('/review');
      } else {
        // Normal flow - check onboarding level
        import('@/lib/onboarding/state').then(({ calculateOnboardingLevel }) => {
          calculateOnboardingLevel(address).then(level => {
            if (level === 0) {
              // No profile for this profile wallet - new user, create beta access record
              const betaCode = localStorage.getItem('beta_invite_code');
              if (betaCode) {
                fetch('/api/beta-code', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    code: betaCode,
                    action: 'createAccess',
                    wallet: address.toLowerCase(),
                  }),
                }).catch(err => {
                  console.warn('[auth] Failed to create beta access record:', err);
                });
              }
              router.push('/onboarding');
            } else {
              router.push('/me');
            }
          }).catch(() => {
            router.push('/me');
          });
        });
      }
    } catch (err) {
      console.error('[Auth Page] WalletConnect connection error', {
        error: err instanceof Error ? err.message : 'Unknown error',
        errorObject: err,
      });

      let errorMessage = 'Failed to connect with WalletConnect';
      if (err instanceof Error) {
        if (err.message.includes('cancelled') || err.message.includes('rejected') || err.message.includes('closed')) {
          errorMessage = 'Connection cancelled. Please try again when ready.';
        } else if (err.message.includes('project ID')) {
          errorMessage = 'WalletConnect not configured. Please contact support.';
        } else {
          errorMessage = err.message;
        }
      }
      setError(errorMessage);
      setIsConnectingWalletConnect(false);
    }
  };

  // Toggle review mode on/off
  const handleReviewModeToggle = () => {
    setIsReviewModeEnabled(!isReviewModeEnabled);
    if (!isReviewModeEnabled) {
      // When enabling, clear password and verification state
      setReviewModePassword('');
      setIsPasswordVerified(false);
    } else {
      // When disabling, clear verification state
      setIsPasswordVerified(false);
    }
  };

  // Verify password BEFORE wallet connection
  const handleVerifyPassword = async () => {
    if (!reviewModePassword.trim()) {
      setError('Please enter a password');
      return;
    }

    setIsVerifyingPassword(true);
    setError('');

    try {
      // Client-side password hashing (SHA-256)
      const encoder = new TextEncoder();
      const data = encoder.encode(reviewModePassword.trim());
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Compare to public env var (inlined at build time in Next.js)
      const expectedHash = process.env.NEXT_PUBLIC_ARKIV_REVIEW_PASSWORD_SHA256;
      
      if (!expectedHash) {
        setError('Review mode not configured');
        setIsVerifyingPassword(false);
        return;
      }

      // Normalize case for comparison (hash should be lowercase)
      if (hashHex.toLowerCase() !== expectedHash.toLowerCase()) {
        setError('Invalid password');
        setIsPasswordVerified(false);
        setIsVerifyingPassword(false);
        return;
      }

      // Password verified - show green check and enable wallet connection
      setIsPasswordVerified(true);
      setIsVerifyingPassword(false);
    } catch (err) {
      console.error('[Auth Page] Password verification error', err);
      setError(err instanceof Error ? err.message : 'Failed to verify password');
      setIsPasswordVerified(false);
      setIsVerifyingPassword(false);
    }
  };

  // Handle grant issuance after wallet connection (password already verified)
  const handleReviewModeActivate = async () => {
    if (!reviewModeWallet) return;

    setIsActivatingReviewMode(true);
    setError('');

    try {
      // Password already verified - request server to issue review mode grant
      // Beta code is already verified at /beta page before user reaches /auth
      const grantRes = await fetch('/api/arkiv-review/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectWallet: reviewModeWallet,
        }),
      });

      const grantData = await grantRes.json();
      if (!grantData.ok) {
        setError(grantData.error || 'Failed to issue review mode grant');
        setIsActivatingReviewMode(false);
        return;
      }

      // Grant issued successfully - wait a moment for Arkiv indexing, then verify
      // Use retry mechanism with exponential backoff
      const { getLatestValidReviewModeGrant } = await import('@/lib/arkiv/reviewModeGrant');
      const { getProfileByWallet } = await import('@/lib/arkiv/profile');

      let grant = null;
      const maxRetries = 5;
      const initialDelay = 1000; // Start with 1 second

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        await new Promise(resolve => setTimeout(resolve, initialDelay * Math.pow(2, attempt)));

        grant = await getLatestValidReviewModeGrant(reviewModeWallet);
        if (grant) {
          break; // Grant found, exit retry loop
        }
      }

      // Check profile
      const profile = await getProfileByWallet(reviewModeWallet).catch(() => null);

      if (grant) {
        // Success - clear review mode state and route
        setIsReviewModeEnabled(false);
        setReviewModePassword('');
        setIsPasswordVerified(false);
        setReviewModeWallet(null);
        setIsActivatingReviewMode(false);

        // Route to review onboarding if no profile, otherwise to dashboard
        if (profile) {
          router.push('/me');
        } else {
          router.push('/review');
        }
      } else {
        // Grant was issued but not yet queryable - route anyway and let /review page handle it
        // The /review page will retry the grant check
        console.warn('[Auth Page] Grant issued but not yet queryable, routing to /review anyway');
        setIsReviewModeEnabled(false);
        setReviewModePassword('');
        setIsPasswordVerified(false);
        setReviewModeWallet(null);
        setIsActivatingReviewMode(false);
        router.push('/review');
      }
    } catch (err) {
      console.error('[Auth Page] Review mode grant issuance error', {
        error: err instanceof Error ? err.message : 'Unknown error',
        errorObject: err,
      });
      setError(err instanceof Error ? err.message : 'Failed to issue review mode grant');
      setIsActivatingReviewMode(false);
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


  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 text-gray-900 dark:text-gray-100">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="mb-4">
          <BackButton href="/beta" forceHref={true} />
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
              title="Don't worry: you do not need any funds in your wallet to use our app. In fact, we recommend using a wallet without any funds as your profile wallet. Read more in the betadocs"
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

        {/* Arkiv Review Mode Toggle - Before wallet connection */}
        {mounted && (
          <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
            <div className="flex items-center gap-3 mb-3">
              <button
                type="button"
                onClick={handleReviewModeToggle}
                disabled={isConnecting || isActivatingReviewMode}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  isReviewModeEnabled
                    ? 'bg-purple-600 dark:bg-purple-500'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
                aria-label="Toggle Arkiv Review Mode"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isReviewModeEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <label
                onClick={handleReviewModeToggle}
                className="text-sm font-medium text-purple-800 dark:text-purple-300 cursor-pointer select-none"
              >
                Arkiv Review Mode
              </label>
            </div>
            {isReviewModeEnabled && (
              <div className="mt-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={reviewModePassword}
                    onChange={(e) => {
                      setReviewModePassword(e.target.value);
                      setIsPasswordVerified(false); // Reset verification when password changes
                    }}
                    placeholder="Enter review password"
                    disabled={isConnecting || isActivatingReviewMode || isVerifyingPassword}
                    className="flex-1 px-3 py-2 text-sm border border-purple-300 dark:border-purple-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isConnecting && !isActivatingReviewMode && !isVerifyingPassword && reviewModePassword.trim()) {
                        e.preventDefault();
                        handleVerifyPassword();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleVerifyPassword}
                    disabled={isConnecting || isActivatingReviewMode || isVerifyingPassword || !reviewModePassword.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isVerifyingPassword ? 'Verifying...' : 'Verify'}
                  </button>
                </div>
                {isPasswordVerified && (
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Password verified</span>
                  </div>
                )}
                <p className="text-xs text-purple-600 dark:text-purple-400">
                  Verify password first, then click "Connect Wallet" to activate review mode.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-4 mb-6">
          {/* Connect Wallet Button - Always visible per acceptance criteria */}
          <ArkivQueryTooltip
            query={[
              `getProfileByWallet(wallet='{address}')`,
              `type='profile', wallet='{wallet}'`,
              `calculateOnboardingLevel(wallet='{address}')`,
              `Queries: profile, asks, offers, onboarding_events`,
            ]}
            label="Auth Queries"
          >
            <button
              onClick={handleMetaMaskConnect}
              disabled={isConnecting || (isReviewModeEnabled && !isPasswordVerified)}
              className="w-full px-6 py-3 text-base font-medium text-white bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-500 rounded-lg transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:bg-green-500 dark:disabled:hover:bg-green-600"
            >
              {isConnecting ? 'Connecting...' : (
                <>
                  Connect Wallet (MetaMask) <span className="text-sm opacity-90">← recommended</span>
                </>
              )}
            </button>
          </ArkivQueryTooltip>

          {/* WalletConnect Button - Feature flagged */}
          {mounted && isWalletConnectEnabled && (
            <ArkivQueryTooltip
              query={[
                `getProfileByWallet(wallet='{address}')`,
                `type='profile', wallet='{wallet}'`,
                `calculateOnboardingLevel(wallet='{address}')`,
                `Queries: profile, asks, offers, onboarding_events`,
              ]}
              label="Auth Queries"
            >
              <button
                onClick={handleWalletConnectConnect}
                disabled={isConnectingWalletConnect || isConnecting || (isReviewModeEnabled && !isPasswordVerified)}
                className="w-full px-6 py-3 text-base font-medium text-gray-700 dark:text-gray-300 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:bg-gray-200 dark:disabled:hover:bg-gray-700"
              >
                {isConnectingWalletConnect ? 'Connecting...' : 'Connect with WalletConnect'}
              </button>
            </ArkivQueryTooltip>
          )}

          {mounted && isWalletConnectEnabled && (
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center -mt-2 mb-2">
              Use any mobile wallet via QR / deep link. Works on desktop and mobile.
            </p>
          )}

          {/* Mobile helper text - show appropriate message based on context */}
          {mounted && isMobile && (
            <>
              {isMetaMaskMobileBrowser ? (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-sm text-green-800 dark:text-green-300 text-center">
                    You're in MetaMask. Tap Connect to continue.
                  </p>
                </div>
              ) : openingMetaMask ? (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-300 text-center">
                    Opening MetaMask…
                    {getMetaMaskInstallUrl() ? (
                      <>
                        {' '}If you don't have MetaMask yet,{' '}
                        <a
                          href={getMetaMaskInstallUrl()!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                        >
                          install MetaMask
                        </a>.
                      </>
                    ) : null}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                  On mobile, connect via the MetaMask in-app browser. Tap "Connect Wallet" to open it.
                  {getMetaMaskInstallUrl() ? (
                    <>
                      {' '}If you don't have MetaMask yet,{' '}
                      <a
                        href={getMetaMaskInstallUrl()!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        install MetaMask
                      </a>.
                    </>
                  ) : null}
                </p>
              )}
            </>
          )}

          {mounted && (
            <>
              <div className="flex items-center gap-3 my-2">
                <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
                <span className="text-sm text-gray-500 dark:text-gray-400">or</span>
                <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
              </div>

              <PasskeyLoginButton
                onSuccess={(address) => {
                  // Wallet connected via passkey, redirect handled by component
                }}
                onError={(error) => {
                  setError(error.message);
                }}
              />
            </>
          )}

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
            </a>. You do not need any funds to use the application.{' '}
            <a
              href="/docs/arkiv/wallet-architecture"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-800 dark:text-yellow-300 underline hover:text-yellow-900 dark:hover:text-yellow-200"
            >
              Learn more about profile wallet vs signing wallet
            </a>.
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


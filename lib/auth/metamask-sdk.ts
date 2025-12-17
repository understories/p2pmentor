/**
 * MetaMask SDK Wrapper
 *
 * Provides unified API for MetaMask connections across desktop and mobile.
 * Uses MetaMask SDK for automatic deep linking on mobile browsers.
 *
 * Reference: refs/metamask-mobile-integration-plan.md
 */

import { MetaMaskSDK } from '@metamask/sdk';

let sdkInstance: MetaMaskSDK | null = null;

/**
 * Get or create MetaMask SDK instance
 *
 * Singleton pattern to ensure only one SDK instance exists.
 * Configured for mobile browser redirects with proper deep linking.
 */
export function getMetaMaskSDK(): MetaMaskSDK {
  if (typeof window === 'undefined') {
    throw new Error('MetaMask SDK must be initialized in browser context');
  }

  if (!sdkInstance) {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.p2pmentor.com';
    const currentUrl = typeof window !== 'undefined' ? window.location.href : `${origin}/auth`;

    console.log('[MetaMask SDK] Initializing SDK', {
      origin,
      currentUrl,
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'N/A',
      isMobile: typeof window !== 'undefined' ? /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(window.navigator.userAgent.toLowerCase()) : false,
    });

    sdkInstance = new MetaMaskSDK({
      dappMetadata: {
        name: 'p2pmentor',
        url: origin,
      },
      // Disable SDK deeplinking - we handle mobile redirects explicitly via openInMetaMaskBrowser
      // This prevents the SDK from trying to do mobile redirect magic behind our back
      useDeeplink: false,
      // Don't check installation immediately (let user initiate connection)
      checkInstallationImmediately: false,
      // Disable analytics
      enableAnalytics: false,
    });

    console.log('[MetaMask SDK] SDK initialized successfully', {
      hasProvider: !!sdkInstance.getProvider(),
    });
  }
  return sdkInstance;
}

/**
 * Connect to MetaMask using SDK
 *
 * Works on both desktop (extension) and mobile (deep link).
 * Automatically handles deep linking for mobile browsers.
 * On mobile, this will open MetaMask app and redirect back to the browser.
 *
 * @returns Wallet address (0x... format)
 * @throws Error if MetaMask is not available or connection fails
 */
export async function connectWithSDK(): Promise<`0x${string}`> {
  console.log('[MetaMask SDK] Starting connection via SDK');

  try {
    const sdk = getMetaMaskSDK();
    const provider = sdk.getProvider();

    console.log('[MetaMask SDK] Provider check', {
      hasProvider: !!provider,
      providerType: provider ? (provider as any).isMetaMask ? 'MetaMask' : 'Other' : 'None',
      hasWindowEthereum: typeof window !== 'undefined' && !!window.ethereum,
    });

    if (!provider) {
      console.error('[MetaMask SDK] Provider not available');
      throw new Error('MetaMask provider not available');
    }

    // Request accounts - SDK handles deep linking on mobile automatically
    // On mobile browsers, this will:
    // 1. Open MetaMask app via deep link
    // 2. User selects wallet in MetaMask app
    // 3. MetaMask redirects back to the browser with the connection
    // 4. SDK handles the redirect and completes the connection
    console.log('[MetaMask SDK] Requesting accounts via provider.request');
    const accounts = await provider.request({
      method: 'eth_requestAccounts',
    }) as string[];

    console.log('[MetaMask SDK] Accounts received', {
      count: accounts?.length || 0,
      firstAccount: accounts?.[0] ? `${accounts[0].substring(0, 6)}...${accounts[0].substring(accounts[0].length - 4)}` : 'None',
    });

    if (!accounts || accounts.length === 0) {
      console.error('[MetaMask SDK] No accounts returned');
      throw new Error('No accounts returned from MetaMask');
    }

    console.log('[MetaMask SDK] Connection successful');
    return accounts[0] as `0x${string}`;
  } catch (error: any) {
    console.error('[MetaMask SDK] Connection failed', {
      error: error?.message || 'Unknown error',
      code: error?.code,
      stack: error?.stack,
      fullError: error,
    });

    // Re-throw with more context
    if (error?.code === 4001 || error?.message?.includes('User rejected') || error?.message?.includes('user rejected')) {
      throw new Error('Connection cancelled by user');
    }
    if (error?.message) {
      throw new Error(`MetaMask SDK connection failed: ${error.message}`);
    }
    throw new Error('Failed to connect to MetaMask');
  }
}

/**
 * Check if MetaMask SDK is available
 *
 * @returns True if SDK can be initialized
 */
export function isSDKAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    getMetaMaskSDK();
    return true;
  } catch {
    return false;
  }
}


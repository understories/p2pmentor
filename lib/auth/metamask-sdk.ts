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
 */
export function getMetaMaskSDK(): MetaMaskSDK {
  if (typeof window === 'undefined') {
    throw new Error('MetaMask SDK must be initialized in browser context');
  }

  if (!sdkInstance) {
    sdkInstance = new MetaMaskSDK({
      dappMetadata: {
        name: 'p2pmentor',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://www.p2pmentor.com',
      },
      // Enable mobile deep linking
      enableMobile: true,
    });
  }
  return sdkInstance;
}

/**
 * Connect to MetaMask using SDK
 *
 * Works on both desktop (extension) and mobile (deep link).
 * Automatically handles deep linking for mobile browsers.
 *
 * @returns Wallet address (0x... format)
 * @throws Error if MetaMask is not available or connection fails
 */
export async function connectWithSDK(): Promise<`0x${string}`> {
  try {
    const sdk = getMetaMaskSDK();
    const provider = sdk.getProvider();

    if (!provider) {
      throw new Error('MetaMask provider not available');
    }

    // Request accounts - SDK handles deep linking on mobile automatically
    const accounts = await provider.request({
      method: 'eth_requestAccounts',
    }) as string[];

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts returned from MetaMask');
    }

    return accounts[0] as `0x${string}`;
  } catch (error: any) {
    // Re-throw with more context
    if (error.message) {
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


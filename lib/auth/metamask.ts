/**
 * MetaMask authentication utilities
 *
 * Based on mentor-graph implementation with improvements.
 *
 * Reference: refs/mentor-graph/src/wallet.ts
 */

import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
} from "@arkiv-network/sdk";
import { mendoza } from "@arkiv-network/sdk/chains";
import "viem/window";
import { connectWithSDK, isSDKAvailable } from './metamask-sdk';
import { isMobileBrowser } from './mobile-detection';

/**
 * Switch to Mendoza chain in MetaMask
 *
 * If the chain doesn't exist in MetaMask, it will be added automatically.
 *
 * @throws Error if MetaMask is not installed
 */
async function switchToMendozaChain() {
  if (!window.ethereum) {
    throw new Error("MetaMask not installed");
  }

  const chainIdHex = `0x${mendoza.id.toString(16)}`;

  try {
    // Try to switch to the chain
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
  } catch (error: unknown) {
    // Chain doesn't exist, add it
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 4902
    ) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
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
    } else {
      throw error;
    }
  }
}

/**
 * Disconnect MetaMask wallet by revoking permissions
 *
 * This forces MetaMask to show the account selection dialog on next connection.
 *
 * @throws Error if MetaMask is not installed
 */
export async function disconnectWallet(): Promise<void> {
  if (!window.ethereum) {
    throw new Error("MetaMask not installed");
  }

  try {
    // Revoke permissions to force account selection on next connect
    // This uses EIP-2255 wallet_revokePermissions
    await window.ethereum.request({
      method: "wallet_revokePermissions",
      params: [
        {
          eth_accounts: {},
        },
      ],
    });
  } catch (error) {
    // If wallet_revokePermissions is not supported, try to clear accounts
    // Some wallets may not support this method, so we silently fail
    // The important part is that we clear localStorage, which we do in logout handlers
    console.warn("Could not revoke MetaMask permissions:", error);
  }
}

/**
 * Connect to MetaMask and return the connected wallet address
 *
 * Automatically switches to Mendoza testnet chain.
 * Uses MetaMask SDK for mobile support, falls back to direct window.ethereum for desktop.
 * Forces account selection by revoking existing permissions first (if any),
 * then requesting permissions, which ensures the account selection dialog appears.
 *
 * Handles different connection scenarios:
 * - Desktop extension (window.ethereum available)
 * - Mobile app (via SDK deep linking)
 * - MetaMask browser (window.ethereum available on mobile)
 * - Reconnection after deep link redirect
 *
 * @returns Wallet address (0x... format)
 * @throws Error if MetaMask is not installed or connection fails
 *
 * Reference: refs/mentor-graph/src/wallet.ts
 * Reference: refs/metamask-mobile-integration-plan.md
 */
export async function connectWallet(): Promise<`0x${string}`> {
  console.log('[MetaMask] Starting wallet connection', {
    hasWindowEthereum: typeof window !== 'undefined' && !!window.ethereum,
    isSDKAvailable: isSDKAvailable(),
    currentUrl: typeof window !== 'undefined' ? window.location.href : 'N/A',
  });

  // On desktop with extension, prefer direct window.ethereum to avoid SDK issues
  // SDK is primarily for mobile browsers without window.ethereum
  const isDesktopWithExtension = typeof window !== 'undefined' && window.ethereum && !isMobileBrowser();

  // Try SDK first only on mobile or when window.ethereum is not available
  // SDK automatically handles deep linking on mobile
  if (isSDKAvailable() && !isDesktopWithExtension) {
    console.log('[MetaMask] Attempting connection via SDK');
    try {
      const address = await connectWithSDK();
      console.log('[MetaMask] SDK connection successful', {
        address: `${address.substring(0, 6)}...${address.substring(address.length - 4)}`,
      });

      // Switch to Mendoza chain after connection
      // Note: On mobile, chain switching happens in the MetaMask app
      if (window.ethereum) {
        try {
          console.log('[MetaMask] Attempting to switch to Mendoza chain');
          await switchToMendozaChain();
          console.log('[MetaMask] Successfully switched to Mendoza chain');
        } catch (error) {
          // Chain switching is not critical - user can switch manually
          // On mobile, user may need to switch in MetaMask app
          console.warn('[MetaMask] Failed to switch to Mendoza chain:', error);
        }
      }
      return address;
    } catch (error: any) {
      console.warn('[MetaMask] SDK connection failed', {
        error: error?.message || 'Unknown error',
        code: error?.code,
        willFallback: !(error?.code === 4001 || error?.message?.includes('User rejected')),
      });

      // SDK failed - check if it's a user cancellation
      if (error?.code === 4001 || error?.message?.includes('User rejected')) {
        throw new Error('Connection cancelled by user');
      }
      // SDK failed - fall back to direct window.ethereum (desktop extension or MetaMask browser)
      console.warn('[MetaMask] Falling back to direct window.ethereum connection');
    }
  } else {
    if (isDesktopWithExtension) {
      console.log('[MetaMask] Desktop with extension detected, using direct window.ethereum (skipping SDK)');
    } else {
      console.log('[MetaMask] SDK not available, using direct window.ethereum');
    }
  }

  // Fallback to direct window.ethereum (desktop extension or MetaMask browser)
  console.log('[MetaMask] Using direct window.ethereum connection');
  if (!window.ethereum) {
    console.error('[MetaMask] window.ethereum not available');
    throw new Error("No injected wallet provider found in this browser. Install MetaMask (desktop extension) or open this page in the MetaMask mobile browser.");
  }

  // First switch to the correct chain
  try {
    await switchToMendozaChain();
  } catch (error) {
    // Chain switching failure is not critical - continue with connection
    console.warn('Failed to switch to Mendoza chain, continuing with connection:', error);
  }

  // CRITICAL: Always force account selection on /auth page
  // Even if storedWallet exists, we're on /auth so user explicitly wants to connect
  // This prevents auto-login and ensures user always selects account
  const isOnAuthPage = typeof window !== 'undefined' && window.location.pathname === '/auth';

  // Always revoke permissions and request new ones when on /auth page
  // This ensures account selection dialog always appears
  if (isOnAuthPage) {
    try {
      // Revoke existing permissions to force account selection
      await window.ethereum.request({
        method: "wallet_revokePermissions",
        params: [
          {
            eth_accounts: {},
          },
        ],
      });
    } catch (error) {
      // If wallet_revokePermissions is not supported or fails, continue anyway
      // Some wallets may not support this method
    }

    // Request permissions explicitly - this will show account selection dialog
    try {
      await window.ethereum.request({
        method: "wallet_requestPermissions",
        params: [
          {
            eth_accounts: {},
          },
        ],
      });
    } catch (error: any) {
      // If user denies, throw a clear error
      if (error?.code === 4001 || error?.message?.includes('User rejected')) {
        throw new Error('Connection cancelled by user');
      }
      // If wallet_requestPermissions fails, fall back to eth_requestAccounts
      // This maintains backward compatibility
    }
  } else {
    // Not on /auth page - check if we have a stored wallet address
    // If not, this is a fresh login, so we should revoke permissions first
    const storedWallet = typeof window !== 'undefined'
      ? localStorage.getItem('wallet_address')
      : null;

    if (!storedWallet) {
      // Fresh login - revoke existing permissions to force account selection
      try {
        await window.ethereum.request({
          method: "wallet_revokePermissions",
          params: [
            {
              eth_accounts: {},
            },
          ],
        });
      } catch (error) {
        // If wallet_revokePermissions is not supported or fails, continue anyway
        // Some wallets may not support this method
      }

      // Request permissions explicitly - this will show account selection dialog
      // after permissions were revoked, or if this is the first connection
      try {
        await window.ethereum.request({
          method: "wallet_requestPermissions",
          params: [
            {
              eth_accounts: {},
            },
          ],
        });
      } catch (error: any) {
        // If user denies, throw a clear error
        if (error?.code === 4001 || error?.message?.includes('User rejected')) {
          throw new Error('Connection cancelled by user');
        }
        // If wallet_requestPermissions fails, fall back to eth_requestAccounts
        // This maintains backward compatibility
      }
    }
    // If storedWallet exists (reconnecting), skip wallet_requestPermissions
    // and go directly to eth_requestAccounts since permissions already exist
  }

  // Then request accounts (this will use the selected account)
  try {
    console.log('[MetaMask] Requesting accounts via window.ethereum.request');
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    }) as string[];

    console.log('[MetaMask] Accounts received from window.ethereum', {
      count: accounts?.length || 0,
      firstAccount: accounts?.[0] ? `${accounts[0].substring(0, 6)}...${accounts[0].substring(accounts[0].length - 4)}` : 'None',
    });

    if (!accounts || accounts.length === 0) {
      console.error('[MetaMask] No accounts returned from window.ethereum');
      throw new Error("No accounts returned from MetaMask");
    }

    console.log('[MetaMask] Direct connection successful');
    return accounts[0] as `0x${string}`;
  } catch (error: any) {
    console.error('[MetaMask] Direct connection failed', {
      error: error?.message || 'Unknown error',
      code: error?.code,
      stack: error?.stack,
    });

    // Handle user cancellation
    if (error?.code === 4001 || error?.message?.includes('User rejected')) {
      throw new Error('Connection cancelled by user');
    }
    // Re-throw other errors
    throw error;
  }
}

/**
 * Create Arkiv clients (public and wallet) from MetaMask
 *
 * @param account - Wallet address from MetaMask
 * @returns Object with publicClient and walletClient
 * @throws Error if MetaMask is not installed
 *
 * Reference: refs/mentor-graph/src/wallet.ts
 */
export function createArkivClients(account?: `0x${string}`) {
  if (!window.ethereum) {
    throw new Error("MetaMask not installed");
  }

  const publicClient = createPublicClient({
    chain: mendoza,
    transport: http(),
  });

  const walletClient = createWalletClient({
    chain: mendoza,
    transport: custom(window.ethereum),
    account,
  });

  return { publicClient, walletClient };
}


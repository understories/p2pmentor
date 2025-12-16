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
  // Try SDK first (works on both desktop and mobile)
  // SDK automatically handles deep linking on mobile
  if (isSDKAvailable()) {
    try {
      const address = await connectWithSDK();
      // Switch to Mendoza chain after connection
      // Note: On mobile, chain switching happens in the MetaMask app
      if (window.ethereum) {
        try {
          await switchToMendozaChain();
        } catch (error) {
          // Chain switching is not critical - user can switch manually
          // On mobile, user may need to switch in MetaMask app
          console.warn('Failed to switch to Mendoza chain:', error);
        }
      }
      return address;
    } catch (error: any) {
      // SDK failed - check if it's a user cancellation
      if (error?.code === 4001 || error?.message?.includes('User rejected')) {
        throw new Error('Connection cancelled by user');
      }
      // SDK failed - fall back to direct window.ethereum (desktop extension or MetaMask browser)
      console.warn('MetaMask SDK connection failed, falling back to direct connection:', error);
    }
  }

  // Fallback to direct window.ethereum (desktop extension or MetaMask browser)
  if (!window.ethereum) {
    throw new Error("MetaMask not installed. Please install MetaMask or use the mobile app.");
  }

  // First switch to the correct chain
  try {
    await switchToMendozaChain();
  } catch (error) {
    // Chain switching failure is not critical - continue with connection
    console.warn('Failed to switch to Mendoza chain, continuing with connection:', error);
  }

  // Check if we have a stored wallet address in localStorage
  // If not, this is a fresh login, so we should revoke permissions first
  // to ensure account selection dialog appears
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
  }

  // Request permissions explicitly - this will show account selection dialog
  // if permissions were revoked, or if this is the first connection
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

  // Then request accounts (this will use the selected account)
  try {
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    }) as string[];

    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts returned from MetaMask");
    }

    return accounts[0] as `0x${string}`;
  } catch (error: any) {
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


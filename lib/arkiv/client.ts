/**
 * Arkiv client wrapper
 *
 * Based on mentor-graph implementation with improvements for long-term resilience.
 *
 * Provides:
 * - Public client for read operations (no authentication required)
 * - Wallet client from private key (server-side)
 * - Wallet client from MetaMask (client-side)
 *
 * Reference: refs/mentor-graph/src/arkiv/client.ts
 */

import { createPublicClient, createWalletClient, http, custom } from '@arkiv-network/sdk';
import { privateKeyToAccount } from '@arkiv-network/sdk/accounts';
import { kaolin } from '@arkiv-network/sdk/chains';

/**
 * Get public client for read operations
 * No authentication required - can be used on both client and server
 */
export function getPublicClient() {
  return createPublicClient({
    chain: kaolin,
    transport: http(),
  });
}

/**
 * Get wallet client from private key (server-side use)
 *
 * @param privateKey - Private key in format 0x...
 * @returns Wallet client configured for Kaolin testnet
 */
export function getWalletClientFromPrivateKey(privateKey: `0x${string}`) {
  return createWalletClient({
    chain: kaolin,
    transport: http(),
    account: privateKeyToAccount(privateKey),
  });
}

/**
 * Get wallet client from MetaMask (client-side use only)
 *
 * This should only be called in browser context with MetaMask available.
 *
 * @param account - Wallet address from MetaMask
 * @returns Wallet client configured for Kaolin testnet
 * @throws Error if called outside browser or MetaMask not available
 *
 * Reference: refs/mentor-graph/src/arkiv/client.ts
 */
export function getWalletClientFromMetaMask(account: `0x${string}`) {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask not available - this function must be called in browser context');
  }

  return createWalletClient({
    chain: kaolin,
    transport: custom(window.ethereum),
    account,
  });
}

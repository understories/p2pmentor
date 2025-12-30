/**
 * Arkiv client construction
 * 
 * Provides public and wallet clients for Arkiv operations.
 * Supports both local node and Mendoza testnet via ARKIV_TARGET.
 * 
 * Pattern: PAT-QUERY-001 (Indexer-Friendly Query Shapes)
 */

import { createPublicClient, createWalletClient, http, custom } from "@arkiv-network/sdk";
import { privateKeyToAccount } from "@arkiv-network/sdk/accounts";
import { mendoza } from "@arkiv-network/sdk/chains";
import { getArkivTarget, isLocalTarget } from './env';

/**
 * Get RPC URL based on ARKIV_TARGET
 * 
 * @returns RPC URL for the target network
 */
function getRpcUrl(): string {
  if (isLocalTarget()) {
    // Local node default RPC (can be overridden via ARKIV_RPC_URL)
    return process.env.ARKIV_RPC_URL || 'http://localhost:8545';
  }
  
  // Mendoza testnet (default)
  return process.env.ARKIV_RPC_URL || 'https://rpc.mendoza.arkiv.network';
}

/**
 * Get public client for read operations
 * 
 * No authentication required - can be used on both client and server.
 * Automatically uses the correct RPC URL based on ARKIV_TARGET.
 * 
 * @returns Public client configured for the target network
 * 
 * @example
 * ```ts
 * const client = getPublicClient();
 * const query = client.buildQuery();
 * ```
 */
export function getPublicClient() {
  return createPublicClient({
    chain: mendoza,
    transport: http(getRpcUrl()),
  });
}

/**
 * Get wallet client from private key (server-side use)
 * 
 * Used for server-signed writes (Phase 0 pattern).
 * The private key should come from ARKIV_PRIVATE_KEY environment variable.
 * 
 * @param privateKey - Private key in format 0x...
 * @returns Wallet client configured for the target network
 * 
 * @example
 * ```ts
 * const privateKey = requireEnv('ARKIV_PRIVATE_KEY') as `0x${string}`;
 * const walletClient = getWalletClientFromPrivateKey(privateKey);
 * ```
 */
export function getWalletClientFromPrivateKey(privateKey: `0x${string}`) {
  return createWalletClient({
    chain: mendoza,
    transport: http(getRpcUrl()),
    account: privateKeyToAccount(privateKey),
  });
}

/**
 * Get wallet client from MetaMask (client-side use only)
 * 
 * This should only be called in browser context with MetaMask available.
 * 
 * @param account - Wallet address from MetaMask
 * @returns Wallet client configured for the target network
 * @throws Error if called outside browser or MetaMask not available
 * 
 * @example
 * ```ts
 * if (typeof window !== 'undefined' && window.ethereum) {
 *   const walletClient = getWalletClientFromMetaMask(account);
 * }
 * ```
 */
export function getWalletClientFromMetaMask(account: `0x${string}`) {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask not available - this function must be called in browser context');
  }
  
  return createWalletClient({
    chain: mendoza,
    transport: custom(window.ethereum),
    account,
  });
}


/**
 * Arkiv client wrapper
 *
 * Provides:
 * - Public client for read operations (no authentication required)
 * - Wallet client from private key (server-side)
 * - Wallet client from MetaMask (client-side)
 *
 * All clients target the Arkiv Tiramisu testnet via `arkivChain`.
 *
 * RPC access keys: when `ARKIV_API_KEY` is set (server-only env var, created at
 * https://hub.arkiv.network/api-keys), server-side requests send it as an
 * `X-API-KEY` header to avoid the anonymous rate limit. It is never read in the
 * browser and must never be exposed as a NEXT_PUBLIC_ variable.
 */

import { createPublicClient, createWalletClient } from '@arkiv-network/sdk';
import { custom, http, type HttpTransportConfig } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arkivChain } from './chain';

/**
 * HTTP transport for Arkiv RPC
 *
 * - No caching (Next.js would otherwise cache fetch responses)
 * - Bounded timeout and retries, so a rate-limited request fails fast instead
 *   of hanging on a long Retry-After
 * - Access key header on the server when configured
 */
function arkivHttpTransport() {
  const apiKey = typeof window === 'undefined' ? process.env.ARKIV_API_KEY : undefined;

  const fetchOptions: HttpTransportConfig['fetchOptions'] = {
    cache: 'no-store',
    ...(apiKey ? { headers: { 'X-API-KEY': apiKey } } : {}),
  };

  return http(undefined, {
    fetchOptions,
    timeout: 20_000,
    retryCount: 2,
  });
}

/**
 * Get public client for read operations
 * No authentication required - can be used on both client and server
 */
export function getPublicClient() {
  return createPublicClient({
    chain: arkivChain,
    transport: arkivHttpTransport(),
    cacheTime: 0,
  });
}

/**
 * Get wallet client from private key (server-side use)
 *
 * @param privateKey - Private key in format 0x...
 * @returns Wallet client configured for the Arkiv Tiramisu testnet
 */
export function getWalletClientFromPrivateKey(privateKey: `0x${string}`) {
  return createWalletClient({
    chain: arkivChain,
    transport: arkivHttpTransport(),
    account: privateKeyToAccount(privateKey),
    cacheTime: 0,
  });
}

/**
 * Get wallet client from MetaMask (client-side use only)
 *
 * This should only be called in browser context with MetaMask available.
 *
 * @param account - Wallet address from MetaMask
 * @returns Wallet client configured for the Arkiv Tiramisu testnet
 * @throws Error if called outside browser or MetaMask not available
 */
export function getWalletClientFromMetaMask(account: `0x${string}`) {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask not available - this function must be called in browser context');
  }

  return createWalletClient({
    chain: arkivChain,
    transport: custom(window.ethereum),
    account,
  });
}

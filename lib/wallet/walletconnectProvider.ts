/**
 * WalletConnect Provider Singleton
 * 
 * Manages WalletConnect EthereumProvider instance as a module singleton.
 * Provides accessor functions for getting and setting the provider.
 * 
 * Phase 0: In-memory only (no session persistence across reloads).
 * Phase 1: Can add localStorage persistence for session restore.
 * 
 * Reference: WalletConnect Phase 0 Plan
 */

import { EthereumProvider } from '@walletconnect/ethereum-provider';

// Module-level singleton (Phase 0: in-memory only)
let walletConnectProvider: InstanceType<typeof EthereumProvider> | null = null;

/**
 * EIP-1193 Provider type alias for type safety
 */
export type EIP1193Provider = {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

/**
 * Get WalletConnect provider (if available)
 * 
 * Phase 0: Returns null if provider not initialized (e.g., after page reload).
 * Phase 1: Can attempt to restore session from localStorage.
 * 
 * @returns WalletConnect provider or null if not available
 */
export function getWalletConnectProvider(): EIP1193Provider | null {
  // EthereumProvider is EIP-1193 compliant, so we can safely cast it
  return walletConnectProvider as EIP1193Provider | null;
}

/**
 * Set WalletConnect provider (internal use)
 * 
 * Called by connection flow to store provider reference.
 * 
 * @param provider - WalletConnect EthereumProvider instance or null to clear
 */
export function setWalletConnectProvider(provider: InstanceType<typeof EthereumProvider> | null): void {
  walletConnectProvider = provider;
}

/**
 * Disconnect WalletConnect session
 * 
 * Disconnects the provider and clears the singleton.
 * Also clears localStorage wallet_type for the connected address.
 * 
 * @param walletAddress - Optional wallet address to clear wallet_type for
 */
export async function disconnectWalletConnect(walletAddress?: string): Promise<void> {
  if (walletConnectProvider) {
    try {
      await walletConnectProvider.disconnect();
    } catch (error) {
      console.warn('[WalletConnect] Error during disconnect:', error);
    }
    walletConnectProvider = null;
  }

  // Clear wallet_type from localStorage if address provided
  if (typeof window !== 'undefined' && walletAddress) {
    localStorage.removeItem(`wallet_type_${walletAddress.toLowerCase()}`);
  }
}

// Re-export type for convenience
export type { EthereumProvider } from '@walletconnect/ethereum-provider';


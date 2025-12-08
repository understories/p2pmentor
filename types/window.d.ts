/**
 * Global type declarations for browser window extensions
 * 
 * Extends the Window interface to include ethereum provider
 * from MetaMask and other wallet extensions.
 * 
 * This ensures TypeScript recognizes window.ethereum during build.
 * Matches EIP-1193 provider interface.
 */

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
      isMetaMask?: boolean;
      isCoinbaseWallet?: boolean;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
      selectedAddress?: string;
      chainId?: string;
    };
  }
}

export {};


/**
 * Unified wallet client getter
 * 
 * Auto-detects wallet type (MetaMask or Passkey) and returns appropriate wallet client.
 * Follows same pattern as MetaMask integration for drop-in compatibility.
 * 
 * This allows entity creation helpers to work with both MetaMask and Passkey wallets.
 * 
 * Reference: Arkiv Passkey Wallet Beta Implementation Plan
 */

import { getWalletClientFromMetaMask } from '@/lib/arkiv/client';
import { getWalletClientFromPasskey } from './getWalletClientFromPasskey';

/**
 * Get wallet client from active wallet (auto-detects type)
 * 
 * Checks localStorage to determine if user is using MetaMask or Passkey,
 * then returns the appropriate wallet client.
 * 
 * @param walletAddress - Wallet address (0x...)
 * @returns Wallet client configured for Mendoza testnet
 * @throws Error if wallet type cannot be determined or wallet not available
 * 
 * @example
 * ```ts
 * // Works with both MetaMask and Passkey
 * const walletClient = await getWalletClient(walletAddress);
 * await walletClient.createEntity({ ... });
 * ```
 */
export async function getWalletClient(walletAddress: `0x${string}`) {
  if (typeof window === 'undefined') {
    throw new Error('getWalletClient must be called in browser context');
  }

  // Check wallet type from localStorage
  // Format: wallet_type_0x... = 'metamask' | 'passkey'
  const walletType = localStorage.getItem(`wallet_type_${walletAddress.toLowerCase()}`);
  
  if (walletType === 'passkey') {
    // Use passkey wallet
    const userId = localStorage.getItem('passkey_user_id');
    const credentialID = userId ? localStorage.getItem(`passkey_credential_${userId}`) : null;
    
    if (!userId || !credentialID) {
      throw new Error('Passkey wallet credentials not found. Please log in again.');
    }
    
    return await getWalletClientFromPasskey(userId, credentialID);
  }
  
  // Default to MetaMask (or if walletType is 'metamask' or null)
  // This maintains backward compatibility
  if (!window.ethereum) {
    throw new Error('MetaMask not available and passkey wallet not found');
  }
  
  return getWalletClientFromMetaMask(walletAddress);
}

/**
 * Set wallet type in localStorage
 * 
 * Helper to store wallet type during authentication.
 * 
 * @param walletAddress - Wallet address
 * @param type - Wallet type ('metamask' | 'passkey')
 */
export function setWalletType(walletAddress: `0x${string}`, type: 'metamask' | 'passkey') {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`wallet_type_${walletAddress.toLowerCase()}`, type);
  }
}

/**
 * Get wallet type from localStorage
 * 
 * @param walletAddress - Wallet address
 * @returns Wallet type or null if not set
 */
export function getWalletType(walletAddress: `0x${string}`): 'metamask' | 'passkey' | null {
  if (typeof window === 'undefined') {
    return null;
  }
  
  const type = localStorage.getItem(`wallet_type_${walletAddress.toLowerCase()}`);
  return type === 'metamask' || type === 'passkey' ? type : null;
}


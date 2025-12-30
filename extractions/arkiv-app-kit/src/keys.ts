/**
 * Stable entity key derivation
 * 
 * Provides deterministic key derivation for Pattern B (stable entity key updates).
 * Keys are derived from entity type + identifying attributes (e.g., wallet, spaceId).
 * 
 * Pattern: PAT-UPDATE-001 (Stable Entity Key Updates)
 */

import { normalizeWallet } from './wallet';
import { getSpaceId } from './space';

/**
 * Derive a stable entity key from type and identifying attributes
 * 
 * This creates a deterministic key that can be used for Pattern B updates.
 * The key is derived from:
 * - Entity type
 * - Space ID (from config or provided)
 * - Identifying attributes (e.g., wallet)
 * 
 * The key format is: `type:spaceId:attr1:attr2:...`
 * 
 * @param type - Entity type
 * @param identifyingAttrs - Object with identifying attributes (e.g., { wallet: '0x...' })
 * @param options - Options for key derivation
 * @returns Deterministic entity key
 * 
 * @example
 * ```ts
 * // Derive key for user profile
 * const key = deriveStableKey('user_profile', { wallet: '0xABC123...' });
 * // Returns: 'user_profile:beta-launch:0xabc123...'
 * 
 * // Derive key for notification preference
 * const prefKey = deriveStableKey('notification_preference', { 
 *   wallet: '0xABC123...',
 *   notification_type: 'email'
 * });
 * ```
 */
export function deriveStableKey(
  type: string,
  identifyingAttrs: Record<string, string>,
  options: { spaceId?: string } = {}
): string {
  if (!type || type.trim().length === 0) {
    throw new Error('Entity type is required for key derivation');
  }
  
  // Get space ID (from config or provided)
  const spaceId = options.spaceId || getSpaceId();
  
  // Build key parts: type, spaceId, then sorted identifying attributes
  const parts: string[] = [type, spaceId];
  
  // Sort attributes by key for deterministic ordering
  const sortedKeys = Object.keys(identifyingAttrs).sort();
  
  for (const key of sortedKeys) {
    const value = identifyingAttrs[key];
    if (value) {
      // Normalize wallet addresses if this looks like a wallet field
      const normalized = (key.toLowerCase().includes('wallet') || 
                         key.toLowerCase().includes('address'))
        ? normalizeWallet(value)
        : value.toLowerCase();
      
      parts.push(`${key}:${normalized}`);
    }
  }
  
  return parts.join(':');
}

/**
 * Derive a stable key for wallet-scoped entities
 * 
 * Convenience helper for the common case of wallet-scoped entities.
 * 
 * @param type - Entity type
 * @param wallet - Wallet address (will be normalized)
 * @param options - Options for key derivation
 * @returns Deterministic entity key
 * 
 * @example
 * ```ts
 * const key = deriveWalletKey('user_profile', '0xABC123...');
 * ```
 */
export function deriveWalletKey(
  type: string,
  wallet: string,
  options: { spaceId?: string } = {}
): string {
  return deriveStableKey(type, { wallet }, options);
}

/**
 * Parse a stable key into its components
 * 
 * Useful for debugging or extracting information from a key.
 * 
 * @param key - Stable entity key
 * @returns Parsed key components
 * 
 * @example
 * ```ts
 * const parsed = parseStableKey('user_profile:beta-launch:wallet:0xabc123...');
 * // Returns: { type: 'user_profile', spaceId: 'beta-launch', attrs: { wallet: '0xabc123...' } }
 * ```
 */
export function parseStableKey(key: string): {
  type: string;
  spaceId: string;
  attrs: Record<string, string>;
} {
  const parts = key.split(':');
  
  if (parts.length < 2) {
    throw new Error(`Invalid stable key format: ${key}`);
  }
  
  const type = parts[0];
  const spaceId = parts[1];
  const attrs: Record<string, string> = {};
  
  // Parse remaining parts as key:value pairs
  for (let i = 2; i < parts.length; i += 2) {
    if (i + 1 < parts.length) {
      attrs[parts[i]] = parts[i + 1];
    }
  }
  
  return { type, spaceId, attrs };
}


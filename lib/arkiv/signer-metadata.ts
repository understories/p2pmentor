/**
 * Signer metadata helper
 *
 * Part of U1.x.2: Central Signer Metadata on Writes
 * Adds signer_wallet metadata to entity attributes for auditability.
 */

import { privateKeyToAccount } from 'viem/accounts';
import type { AttrRecord } from './schema';

/**
 * Add signer metadata to attributes
 *
 * @param attributes - Existing attributes (snake_case record)
 * @param privateKey - Private key to derive signing wallet from
 * @returns Attributes with signer_wallet added
 */
export function addSignerMetadata<T extends AttrRecord>(
  attributes: T,
  privateKey: `0x${string}`
): T & { signer_wallet: string } {
  if (typeof attributes.signer_wallet === 'string' && attributes.signer_wallet) {
    return attributes as T & { signer_wallet: string };
  }
  return { ...attributes, signer_wallet: getSignerWallet(privateKey) };
}

/**
 * Get signer wallet address from private key
 *
 * @param privateKey - Private key
 * @returns Signing wallet address (lowercase)
 */
export function getSignerWallet(privateKey: `0x${string}`): string {
  return privateKeyToAccount(privateKey).address.toLowerCase();
}

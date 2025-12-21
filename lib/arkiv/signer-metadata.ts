/**
 * Signer metadata helper
 *
 * Part of U1.x.2: Central Signer Metadata on Writes
 * Adds signer_wallet metadata to entity attributes for auditability.
 */

import { privateKeyToAccount } from '@arkiv-network/sdk/accounts';

/**
 * Add signer metadata to attributes
 *
 * @param attributes - Existing attributes
 * @param privateKey - Private key to derive signing wallet from
 * @returns Attributes with signer_wallet added
 */
export function addSignerMetadata(
  attributes: Array<{ key: string; value: string }>,
  privateKey: `0x${string}`
): Array<{ key: string; value: string }> {
  const signerWallet = privateKeyToAccount(privateKey).address;
  
  // Check if signer_wallet already exists (avoid duplicates)
  const hasSignerMetadata = attributes.some(attr => attr.key === 'signer_wallet');
  
  if (hasSignerMetadata) {
    return attributes; // Already has signer metadata
  }
  
  return [
    ...attributes,
    { key: 'signer_wallet', value: signerWallet.toLowerCase() },
  ];
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


/**
 * Wallet normalization helpers
 * 
 * Ensures wallet addresses are consistently normalized (lowercase) across
 * all Arkiv operations. This prevents case-sensitivity bugs.
 * 
 * Pattern: PAT-IDENTITY-001 (Wallet Normalization)
 */

/**
 * Normalize wallet address to lowercase
 * 
 * Arkiv stores wallet addresses in lowercase. This helper ensures consistency
 * in both writes and queries, preventing "wallet not found" bugs due to
 * case mismatches.
 * 
 * @param wallet - Wallet address (may be mixed case)
 * @returns Normalized wallet address (lowercase)
 * 
 * @example
 * ```ts
 * const normalized = normalizeWallet('0xABC123...'); // Returns '0xabc123...'
 * ```
 */
export function normalizeWallet(wallet: string): string {
  if (!wallet) {
    throw new Error('Wallet address cannot be empty');
  }
  
  // Ensure it starts with 0x
  const trimmed = wallet.trim();
  if (!trimmed.startsWith('0x')) {
    throw new Error(`Invalid wallet format: must start with 0x. Got: ${trimmed}`);
  }
  
  // Normalize to lowercase
  return trimmed.toLowerCase();
}

/**
 * Validate wallet address format
 * 
 * Basic validation that wallet address looks like a valid Ethereum address.
 * Does not validate checksum or network - just format.
 * 
 * @param wallet - Wallet address to validate
 * @returns True if wallet format is valid
 * 
 * @example
 * ```ts
 * if (validateWalletFormat(wallet)) {
 *   const normalized = normalizeWallet(wallet);
 * }
 * ```
 */
export function validateWalletFormat(wallet: string): boolean {
  if (!wallet) {
    return false;
  }
  
  const trimmed = wallet.trim();
  
  // Must start with 0x and be 42 characters (0x + 40 hex chars)
  if (!trimmed.startsWith('0x') || trimmed.length !== 42) {
    return false;
  }
  
  // Must be hex characters after 0x
  const hexPart = trimmed.slice(2);
  return /^[0-9a-fA-F]+$/.test(hexPart);
}


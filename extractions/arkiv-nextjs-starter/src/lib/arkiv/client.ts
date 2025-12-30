/**
 * Arkiv client setup
 * 
 * Uses Arkiv App Primitives for client construction.
 * This follows PAT-QUERY-001 (Indexer-Friendly Query Shapes).
 */

// Import from app-kit (using copy-in approach for this template)
// In production, you could use workspace monorepo or git submodule
import { getPublicClient, getWalletClientFromPrivateKey } from '../../../../arkiv-app-kit/src/client';
import { requireEnv } from '../../../../arkiv-app-kit/src/env';

// Re-export for convenience
export { getPublicClient, getWalletClientFromPrivateKey };

/**
 * Get wallet client for server-side writes
 * 
 * Uses ARKIV_PRIVATE_KEY from environment (fail-closed).
 * This is the server signer wallet for Phase 0 writes.
 */
export function getServerWalletClient() {
  const privateKey = requireEnv('ARKIV_PRIVATE_KEY') as `0x${string}`;
  return getWalletClientFromPrivateKey(privateKey);
}


/**
 * Configuration and environment variables
 *
 * Based on mentor-graph implementation.
 *
 * Reference: refs/mentor-graph/src/config.ts
 */

import { privateKeyToAccount } from "@arkiv-network/sdk/accounts"

export const ARKIV_PRIVATE_KEY = process.env.ARKIV_PRIVATE_KEY as `0x${string}` | undefined;

/**
 * Derive wallet address from the private key if available
 * This is used as a fallback when no wallet is connected via MetaMask
 */
export const CURRENT_WALLET = ARKIV_PRIVATE_KEY
  ? privateKeyToAccount(ARKIV_PRIVATE_KEY).address
  : undefined;

/**
 * Space ID for data isolation
 *
 * Used to separate different environments:
 * - 'beta-launch': Production beta data
 * - 'local-dev': Development/test data
 * - 'local-dev-seed': Seed/example data for builder mode
 *
 * Can be overridden via BETA_SPACE_ID environment variable.
 * Defaults to 'beta-launch' in production, 'local-dev' in development.
 */
export const SPACE_ID = process.env.BETA_SPACE_ID ||
  (process.env.NODE_ENV === 'production' ? 'beta-launch' : 'local-dev');

// Jitsi configuration
export const JITSI_BASE_URL = process.env.JITSI_BASE_URL || 'https://meet.jit.si';

// The Graph subgraph configuration (optional, for future use)
// See docs/graph_indexing_plan.md for details
export const GRAPH_SUBGRAPH_URL = process.env.GRAPH_SUBGRAPH_URL;
export const USE_SUBGRAPH_FOR_NETWORK = process.env.USE_SUBGRAPH_FOR_NETWORK === 'true';

// Beta invite code (configured via environment variable for security)
// This should be set in Vercel environment variables, not in code
export const BETA_INVITE_CODE = process.env.NEXT_PUBLIC_BETA_INVITE_CODE;

// Admin password (configured via environment variable for security)
// This should be set in Vercel environment variables, not in code
// Server-side only (not NEXT_PUBLIC_) for security
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

/**
 * Entity update mode for migration
 *
 * Controls whether entities are updated in place (new pattern) or create new entities (old pattern).
 * This is a time-bounded migration flag to prevent mixed-mode data.
 *
 * Modes:
 * - 'off': Old behavior (create new entities on update)
 * - 'shadow': Write canonical updates + validate reads work for both paths (or write both)
 * - 'on': Only canonical update path (migration complete)
 *
 * Once a wallet is marked as migrated, it always uses update mode (no reverting).
 *
 * Based on entity update implementation plan (refs/entity-update-implementation-plan.md).
 */
export type EntityUpdateMode = 'off' | 'shadow' | 'on';
export const ENTITY_UPDATE_MODE: EntityUpdateMode =
  (process.env.ENTITY_UPDATE_MODE as EntityUpdateMode) || 'on';

/**
 * Per-wallet migration marker
 *
 * Tracks which wallets have been migrated to the new update pattern.
 * Once a wallet is marked as migrated, it always uses update mode.
 *
 * This is stored in-memory for now. Can be persisted to file/DB for durability.
 *
 * Key: normalized wallet address (lowercase)
 * Value: true if migrated
 */
const migratedWallets = new Set<string>();

/**
 * Check if a wallet has been migrated to the new update pattern
 *
 * @param wallet - Wallet address (will be normalized)
 * @returns True if wallet is marked as migrated
 */
export function isWalletMigrated(wallet: string): boolean {
  return migratedWallets.has(wallet.toLowerCase());
}

/**
 * Mark a wallet as migrated to the new update pattern
 *
 * Once marked, the wallet always uses update mode (no reverting).
 *
 * @param wallet - Wallet address (will be normalized)
 */
export function markWalletMigrated(wallet: string): void {
  migratedWallets.add(wallet.toLowerCase());
  // TODO: Persist to file/DB for durability (can be added later)
}

/**
 * Get private key, throwing if not available
 *
 * Used for API routes that need server-side entity creation.
 * This is the server-side signing wallet (ARKIV_PRIVATE_KEY env var).
 *
 * IMPORTANT: This returns a private key (0x...), NOT a wallet address.
 * Never use a wallet address as a private key - it will cause transaction failures.
 *
 * @throws Error if ARKIV_PRIVATE_KEY is not set
 */
export function getPrivateKey(): `0x${string}` {
  if (!ARKIV_PRIVATE_KEY) {
    throw new Error("ARKIV_PRIVATE_KEY missing in environment. Required for server-side entity creation.");
  }

  // Safety check: Ensure this looks like a private key (64 hex chars after 0x)
  if (!ARKIV_PRIVATE_KEY.startsWith('0x') || ARKIV_PRIVATE_KEY.length !== 66) {
    throw new Error("ARKIV_PRIVATE_KEY appears to be invalid. Expected 0x followed by 64 hex characters.");
  }

  return ARKIV_PRIVATE_KEY;
}


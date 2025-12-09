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

export const SPACE_ID = "local-dev"; // Optionally configurable later

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
 * Get private key, throwing if not available
 * 
 * Used for API routes that need server-side entity creation
 * 
 * @throws Error if ARKIV_PRIVATE_KEY is not set
 */
export function getPrivateKey(): `0x${string}` {
  if (!ARKIV_PRIVATE_KEY) {
    throw new Error("ARKIV_PRIVATE_KEY missing in environment. Required for server-side entity creation.");
  }
  return ARKIV_PRIVATE_KEY;
}


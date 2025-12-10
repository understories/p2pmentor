/**
 * Root Identity Utilities (Virtual v0)
 * 
 * Beta: Virtual RootIdentity - deterministic ID computation without Arkiv entity.
 * Future: Can be upgraded to formal RootIdentity entity using same ID.
 * 
 * Based on profile_stability.md - Beta Launch Plan
 */

import { keccak256, toBytes, toHex } from 'viem';

/**
 * Compute deterministic RootIdentity ID
 * 
 * For beta, this is a virtual ID (not yet stored as Arkiv entity).
 * Uses deterministic hash so future RootIdentity entities can use same ID.
 * 
 * @param identity - Normalized wallet address or Arkiv identity address
 * @returns Deterministic hex string ID
 */
export function computeRootIdentityId(identity: string): string {
  // Normalize identity (lowercase, no whitespace)
  const normalized = identity.toLowerCase().trim();
  
  // Create deterministic ID: hash("p2pmentor-root-v0" || identity)
  // This ensures any indexer can recompute the same ID
  const prefix = 'p2pmentor-root-v0';
  const combined = `${prefix}${normalized}`;
  
  // Use keccak256 for deterministic hashing (matches Ethereum/Arkiv patterns)
  const hash = keccak256(toBytes(combined));
  
  return hash;
}

/**
 * Normalize identity for queries
 * 
 * Ensures consistent identity format across the app.
 * 
 * @param identity - Wallet address or identity string
 * @returns Normalized identity (lowercase, trimmed)
 */
export function normalizeIdentity(identity: string): string {
  return identity.toLowerCase().trim();
}


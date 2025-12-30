/**
 * Schema conventions and attribute helpers
 * 
 * Provides canonical attribute keys and helpers to enforce consistent
 * attribute schemas across all Arkiv templates.
 * 
 * This prevents template-specific attribute name drift and ensures
 * all entities follow the same conventions.
 */

import { normalizeWallet } from './wallet';
import { getSpaceId } from './space';

/**
 * Canonical attribute keys used across all Arkiv entities
 * 
 * These are the standard attribute keys that should be used consistently.
 * Templates should use these constants rather than string literals.
 */
export const ATTR_KEYS = {
  TYPE: 'type',
  SPACE_ID: 'spaceId',
  WALLET: 'wallet',
  SUBJECT_WALLET: 'subject_wallet', // Phase 0: wallet that owns the entity
  ISSUER_WALLET: 'issuer_wallet',   // Grants: wallet that issued the grant
  STATUS: 'status',
  CREATED_AT: 'created_at',
  UPDATED_AT: 'updated_at',
} as const;

/**
 * Attribute key-value pair
 */
export interface Attribute {
  key: string;
  value: string;
}

/**
 * Options for makeAttributes helper
 */
export interface MakeAttributesOptions {
  /** Entity type (required) */
  type: string;
  /** Space ID (if not provided, uses getSpaceId()) */
  spaceId?: string;
  /** Wallet address (will be normalized) */
  wallet?: string;
  /** Subject wallet (Phase 0 - will be normalized) */
  subject_wallet?: string;
  /** Issuer wallet (grants - will be normalized) */
  issuer_wallet?: string;
  /** Status value */
  status?: string;
  /** Created at timestamp (ISO string) */
  created_at?: string;
  /** Updated at timestamp (ISO string) */
  updated_at?: string;
  /** Additional custom attributes */
  [key: string]: string | undefined;
}

/**
 * Make attributes array with enforced conventions
 * 
 * This helper enforces:
 * - `type` is always present (required)
 * - `spaceId` is always present (from config or provided)
 * - Wallet fields are normalized (lowercase)
 * - Consistent attribute key naming
 * 
 * This prevents every template from inventing new attribute names
 * and ensures all entities follow the same conventions.
 * 
 * @param options - Attribute options
 * @returns Array of attribute key-value pairs
 * @throws Error if type is missing or wallet format is invalid
 * 
 * @example
 * ```ts
 * const attributes = makeAttributes({
 *   type: 'user_profile',
 *   wallet: '0xABC123...',
 *   status: 'active',
 * });
 * // Returns:
 * // [
 * //   { key: 'type', value: 'user_profile' },
 * //   { key: 'spaceId', value: 'beta-launch' },
 * //   { key: 'wallet', value: '0xabc123...' },
 * //   { key: 'status', value: 'active' },
 * // ]
 * ```
 */
export function makeAttributes(options: MakeAttributesOptions): Attribute[] {
  const { type, ...rest } = options;
  
  if (!type || type.trim().length === 0) {
    throw new Error('Entity type is required');
  }
  
  const attributes: Attribute[] = [];
  
  // Always include type (required)
  attributes.push({ key: ATTR_KEYS.TYPE, value: type });
  
  // Always include spaceId (from config or provided)
  const spaceId = options.spaceId || getSpaceId();
  attributes.push({ key: ATTR_KEYS.SPACE_ID, value: spaceId });
  
  // Normalize and add wallet fields
  if (rest.wallet) {
    attributes.push({ key: ATTR_KEYS.WALLET, value: normalizeWallet(rest.wallet) });
  }
  
  if (rest.subject_wallet) {
    attributes.push({ key: ATTR_KEYS.SUBJECT_WALLET, value: normalizeWallet(rest.subject_wallet) });
  }
  
  if (rest.issuer_wallet) {
    attributes.push({ key: ATTR_KEYS.ISSUER_WALLET, value: normalizeWallet(rest.issuer_wallet) });
  }
  
  // Add standard timestamp fields
  if (rest.status) {
    attributes.push({ key: ATTR_KEYS.STATUS, value: rest.status });
  }
  
  if (rest.created_at) {
    attributes.push({ key: ATTR_KEYS.CREATED_AT, value: rest.created_at });
  }
  
  if (rest.updated_at) {
    attributes.push({ key: ATTR_KEYS.UPDATED_AT, value: rest.updated_at });
  }
  
  // Add any additional custom attributes
  for (const [key, value] of Object.entries(rest)) {
    // Skip already-processed fields
    if (key === 'spaceId' || key === 'wallet' || key === 'subject_wallet' || 
        key === 'issuer_wallet' || key === 'status' || 
        key === 'created_at' || key === 'updated_at') {
      continue;
    }
    
    // Skip undefined values
    if (value !== undefined) {
      attributes.push({ key, value: String(value) });
    }
  }
  
  return attributes;
}


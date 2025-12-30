/**
 * Space ID management
 * 
 * Space IDs provide data isolation between environments (test/beta/prod).
 * This module enforces fail-closed behavior: never allow hardcoded fallbacks.
 * 
 * Pattern: PAT-SPACE-001 (Space ID as Environment Boundary)
 */

import { requireEnv } from './env';

/**
 * Get Space ID from environment
 * 
 * Space ID is REQUIRED and must come from environment variables.
 * This function throws if SPACE_ID is not set - no silent fallbacks.
 * 
 * Prohibits "cute fallbacks" - makes it painful to hardcode space IDs,
 * easy to use config. This prevents accidental cross-environment data leaks.
 * 
 * @returns Space ID from SPACE_ID environment variable
 * @throws Error if SPACE_ID is not set
 * 
 * @example
 * ```ts
 * const spaceId = getSpaceId(); // Throws if SPACE_ID not set
 * ```
 */
export function getSpaceId(): string {
  return requireEnv('SPACE_ID');
}

/**
 * Validate Space ID format
 * 
 * Basic validation that space ID is not empty and doesn't look like
 * a hardcoded fallback. This is a safety check to catch configuration errors.
 * 
 * @param spaceId - Space ID to validate
 * @returns True if space ID looks valid
 * 
 * @example
 * ```ts
 * const spaceId = getSpaceId();
 * if (!validateSpaceId(spaceId)) {
 *   throw new Error('Invalid space ID format');
 * }
 * ```
 */
export function validateSpaceId(spaceId: string): boolean {
  if (!spaceId || spaceId.trim().length === 0) {
    return false;
  }
  
  // Reject common hardcoded fallback patterns
  const trimmed = spaceId.trim();
  const commonFallbacks = ['local-dev', 'beta-launch', 'prod', 'default'];
  if (commonFallbacks.includes(trimmed.toLowerCase())) {
    // This might be a hardcoded fallback - warn but don't fail
    // (some legitimate space IDs might match these names)
    console.warn(
      `[space.ts] Space ID "${trimmed}" matches a common fallback pattern. ` +
      `Ensure this is intentional and not a hardcoded default.`
    );
  }
  
  return true;
}

/**
 * Get Space ID with validation
 * 
 * Gets Space ID from environment and validates it.
 * This is the recommended way to get Space ID in most cases.
 * 
 * @returns Validated Space ID
 * @throws Error if SPACE_ID is not set or invalid
 * 
 * @example
 * ```ts
 * const spaceId = getValidatedSpaceId();
 * ```
 */
export function getValidatedSpaceId(): string {
  const spaceId = getSpaceId();
  
  if (!validateSpaceId(spaceId)) {
    throw new Error(
      `Invalid SPACE_ID format: "${spaceId}". ` +
      `Space ID must be non-empty and should not be a hardcoded fallback.`
    );
  }
  
  return spaceId;
}


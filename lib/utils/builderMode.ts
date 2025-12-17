/**
 * Builder Mode Utilities
 * 
 * Helper functions for Arkiv Builder Mode to ensure consistent
 * query parameter handling across all pages.
 */

/**
 * Build query string parameters for builder mode
 * 
 * When builder mode is enabled, queries multiple space IDs to show
 * data from all environments (beta-launch, local-dev, local-dev-seed).
 * 
 * @param enabled - Whether builder mode is enabled
 * @returns Query string (e.g., "?builderMode=true&spaceIds=beta-launch,local-dev,local-dev-seed") or empty string
 */
export function buildBuilderModeParams(enabled: boolean): string {
  if (!enabled) {
    return '';
  }
  return '?builderMode=true&spaceIds=beta-launch,local-dev,local-dev-seed';
}

/**
 * Build query string parameters for builder mode (with existing params)
 * 
 * Use this when you already have query parameters and need to append builder mode params.
 * 
 * @param enabled - Whether builder mode is enabled
 * @param existingParams - Existing query parameters (e.g., "?skill=solidity")
 * @returns Query string with builder mode params appended
 */
export function appendBuilderModeParams(enabled: boolean, existingParams: string = ''): string {
  if (!enabled) {
    return existingParams;
  }
  
  const builderParams = 'builderMode=true&spaceIds=beta-launch,local-dev,local-dev-seed';
  
  if (!existingParams || existingParams === '') {
    return `?${builderParams}`;
  }
  
  // If existing params start with ?, append with &
  if (existingParams.startsWith('?')) {
    return `${existingParams}&${builderParams}`;
  }
  
  // Otherwise, add ? and then &
  return `?${existingParams}&${builderParams}`;
}


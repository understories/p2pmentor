/**
 * Safe Redirect URL Validation
 * 
 * Prevents routing to invalid values like "null", "undefined", or non-path strings.
 * Critical for MetaMask mobile browser where URLSearchParams.get() can return null
 * which becomes the string "null" when used in router.push().
 * 
 * Reference: refs/navigation-redirects-audit.md
 */

/**
 * Validates and sanitizes a redirect URL parameter
 * 
 * @param value - Raw value from URLSearchParams.get() (can be null, undefined, or string)
 * @param fallback - Default path to use if value is invalid (default: '/auth')
 * @returns Valid path string starting with '/'
 */
export function safeRedirect(
  value: string | null | undefined,
  fallback: string = '/auth'
): string {
  // Handle null/undefined
  if (!value) return fallback;
  
  // Handle string "null" or "undefined" (common when null gets stringified)
  if (value === 'null' || value === 'undefined') return fallback;
  
  // Must be a valid path starting with '/'
  if (!value.startsWith('/')) return fallback;
  
  // Reject empty path
  if (value === '/') return fallback;
  
  return value;
}

/**
 * Validates a pathname for use in redirect URLs
 * 
 * @param pathname - Pathname from usePathname() hook (can be null/undefined during hydration)
 * @param fallback - Default path to use if pathname is invalid (default: '/auth')
 * @returns Valid path string starting with '/'
 */
export function safePathname(
  pathname: string | null | undefined,
  fallback: string = '/auth'
): string {
  // Handle null/undefined (common during React hydration)
  if (!pathname) return fallback;
  
  // Must be a string
  if (typeof pathname !== 'string') return fallback;
  
  // Must start with '/'
  if (!pathname.startsWith('/')) return fallback;
  
  // Reject empty path
  if (pathname === '/') return fallback;
  
  return pathname;
}


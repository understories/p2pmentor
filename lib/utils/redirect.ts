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
  if (!value) return fallback;

  // Normalize common bad strings
  if (value === 'null' || value === 'undefined') return fallback;

  // Always try to decode once (handles "%2Fauth" -> "/auth")
  let v = value;
  try {
    v = decodeURIComponent(v);
  } catch {
    // If malformed, keep original
  }

  if (v === 'null' || v === 'undefined') return fallback;
  if (!v.startsWith('/')) return fallback;
  if (v === '/') return fallback;

  return v;
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


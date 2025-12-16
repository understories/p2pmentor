/**
 * Mobile Browser Detection Utilities
 *
 * Detects mobile browsers and platforms for MetaMask integration.
 * Used to determine appropriate connection flow (deep linking vs extension).
 *
 * Reference: refs/metamask-mobile-integration-plan.md
 */

/**
 * Check if user is on a mobile browser
 *
 * Uses multiple detection methods:
 * - User agent string matching
 * - Touch support detection
 * - Screen size detection
 *
 * @returns True if mobile browser detected
 */
export function isMobileBrowser(): boolean {
  if (typeof window === 'undefined') return false;

  // Check user agent
  const userAgent = window.navigator.userAgent.toLowerCase();
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;

  // Check touch support
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // Check screen size (mobile typically < 768px)
  const isSmallScreen = window.innerWidth < 768;

  return mobileRegex.test(userAgent) || (hasTouch && isSmallScreen);
}

/**
 * Check if user is in MetaMask mobile browser
 *
 * MetaMask mobile browser has window.ethereum available
 * and typically includes 'metamask' in user agent.
 *
 * @returns True if MetaMask browser detected
 */
export function isMetaMaskBrowser(): boolean {
  if (typeof window === 'undefined') return false;

  // Check if window.ethereum exists
  if (!window.ethereum) return false;

  // Check user agent for MetaMask browser
  const userAgent = window.navigator.userAgent.toLowerCase();
  return userAgent.includes('metamask') || userAgent.includes('trustwallet');
}

/**
 * Get mobile platform type
 *
 * @returns 'ios' | 'android' | 'unknown'
 */
export function getMobilePlatform(): 'ios' | 'android' | 'unknown' {
  if (typeof window === 'undefined') return 'unknown';

  const userAgent = window.navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(userAgent)) return 'ios';
  if (/android/.test(userAgent)) return 'android';
  return 'unknown';
}

/**
 * Check if MetaMask extension is available (desktop)
 *
 * @returns True if window.ethereum exists (extension or MetaMask browser)
 */
export function isMetaMaskAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof window.ethereum !== 'undefined';
}


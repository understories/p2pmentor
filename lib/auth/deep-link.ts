/**
 * MetaMask Deep Linking Utilities
 *
 * Uses the official MetaMask universal link for mobile browser redirects.
 * This is the recommended approach for opening dapps in MetaMask's in-app browser.
 *
 * Reference: MetaMask official documentation
 */

import { getMobilePlatform } from './mobile-detection';

/**
 * Open dapp in MetaMask browser using official universal link
 *
 * Redirects to MetaMask's official universal link which opens the dapp
 * in MetaMask's in-app browser. This avoids the "window.ethereum not available"
 * trap and SDK deeplink edge cases.
 *
 * Uses deterministic construction from known-good primitives to avoid
 * transient browser state issues (e.g., window.location.href being "null"
 * or "about:blank" during navigation).
 *
 * @param dappPath - Path to redirect to (e.g., '/auth'). Defaults to '/auth'.
 *                   Should be a path, not a full URL.
 */
export function openInMetaMaskBrowser(dappPath = '/auth'): void {
  if (typeof window === 'undefined') return;

  // Always construct from known-good primitives
  // window.location.origin is stable even when href is transient
  const origin = window.location.origin || 'https://www.p2pmentor.com';
  const pathname = dappPath.startsWith('/') ? dappPath : `/${dappPath}`;

  // Extract host from origin (more reliable than parsing window.location.href)
  const host = new URL(origin).host;
  const dappUrl = `${host}${pathname}`;

  // Encode the entire dapp URL for the MetaMask universal link
  const encodedDappUrl = encodeURIComponent(dappUrl);

  // Construct the MetaMask universal link
  const metamaskLink = `https://link.metamask.io/dapp/${encodedDappUrl}`;

  console.log('[openInMetaMaskBrowser] Redirecting to MetaMask', {
    origin,
    pathname,
    dappUrl,
    encodedDappUrl,
    metamaskLink,
  });

  window.location.href = metamaskLink;
}

/**
 * Get MetaMask installation URL for current platform
 *
 * @returns App Store or Play Store URL, or null if platform unknown
 */
export function getMetaMaskInstallUrl(): string | null {
  const platform = getMobilePlatform();
  if (platform === 'ios') {
    return 'https://apps.apple.com/app/metamask/id1438144202';
  } else if (platform === 'android') {
    return 'https://play.google.com/store/apps/details?id=io.metamask';
  }
  return null;
}


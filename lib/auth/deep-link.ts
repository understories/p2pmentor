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
 * @param redirectUrl - Optional URL to redirect to (defaults to current page)
 */
export function openInMetaMaskBrowser(redirectUrl?: string): void {
  if (typeof window === 'undefined') return;

  // Use the current page by default
  const url = redirectUrl ?? window.location.href;
  const u = new URL(url);

  // MetaMask expects host+path+query WITHOUT protocol
  // Build the dapp URL: host + pathname + search
  // Note: pathname already includes leading slash, so we get "p2pmentor.com/auth"
  const dappUrl = `${u.host}${u.pathname}${u.search}`;

  // Encode the entire dapp URL for the MetaMask universal link
  // encodeURIComponent will encode / as %2F, which MetaMask should decode
  // However, some browsers/MetaMask versions may not decode properly
  // So we'll use a more explicit encoding approach
  const encodedDappUrl = encodeURIComponent(dappUrl);

  // Construct the MetaMask universal link
  const metamaskLink = `https://link.metamask.io/dapp/${encodedDappUrl}`;

  console.log('[openInMetaMaskBrowser] Redirecting to MetaMask', {
    originalUrl: url,
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


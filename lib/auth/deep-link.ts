/**
 * MetaMask Deep Linking Utilities
 *
 * Generates deep links to MetaMask mobile app for iOS and Android.
 * Handles fallback to app stores if MetaMask is not installed.
 *
 * Reference: refs/metamask-mobile-integration-plan.md
 */

import { getMobilePlatform } from './mobile-detection';

/**
 * Generate MetaMask deep link URL
 *
 * Creates a deep link that opens MetaMask app with connection parameters.
 * Note: User will need to switch to Mendoza testnet after connection.
 *
 * @param redirectUrl - Optional URL to redirect back to after connection
 * @returns Deep link URL string
 */
export function generateMetaMaskDeepLink(redirectUrl?: string): string {
  const baseUrl = 'metamask://';
  const params = new URLSearchParams();

  if (redirectUrl) {
    params.set('redirect', redirectUrl);
  }

  // Add connection parameters
  params.set('action', 'connect');
  // Note: Chain switching to Mendoza will happen after connection

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Open MetaMask app via deep link
 *
 * Attempts to open MetaMask app. If app is not installed,
 * shows fallback to app store after a timeout.
 *
 * @param redirectUrl - Optional URL to redirect back to after connection
 */
export function openMetaMaskApp(redirectUrl?: string): void {
  const deepLink = generateMetaMaskDeepLink(redirectUrl);

  // Try to open MetaMask app
  window.location.href = deepLink;

  // Fallback: Show install prompt after timeout
  // This gives the app time to open if installed
  setTimeout(() => {
    const platform = getMobilePlatform();
    if (platform === 'ios') {
      // Open App Store page for MetaMask
      const confirmed = window.confirm(
        'MetaMask app not found. Would you like to install it from the App Store?'
      );
      if (confirmed) {
        window.open('https://apps.apple.com/app/metamask/id1438144202', '_blank');
      }
    } else if (platform === 'android') {
      // Open Play Store page for MetaMask
      const confirmed = window.confirm(
        'MetaMask app not found. Would you like to install it from the Play Store?'
      );
      if (confirmed) {
        window.open('https://play.google.com/store/apps/details?id=io.metamask', '_blank');
      }
    }
  }, 2000); // 2 second timeout
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


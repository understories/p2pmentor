/**
 * Preference Key Store
 * 
 * Stores notification preference entity keys in localStorage for direct updates.
 * This bypasses the need to query for existing preferences, eliminating race conditions.
 * 
 * Storage format: JSON object keyed by composite key (spaceId:walletLower:notificationId)
 */

const STORE_KEY = 'notification_pref_keys_v1';

export type PrefKeyStore = Record<string, string>;

/**
 * Create composite key for preference key storage
 */
export function makeCompositeKey(spaceId: string, walletLower: string, notificationId: string): string {
  return `${spaceId}:${walletLower}:${notificationId}`;
}

/**
 * Get stored preference key for a notification
 */
export function getPrefKey(spaceId: string, walletLower: string, notificationId: string): string | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as PrefKeyStore;
    const compositeKey = makeCompositeKey(spaceId, walletLower, notificationId);
    return obj[compositeKey] ?? null;
  } catch (error) {
    console.error('[getPrefKey] Error reading from localStorage:', error);
    return null;
  }
}

/**
 * Store preference key for a notification
 */
export function setPrefKey(spaceId: string, walletLower: string, notificationId: string, prefKey: string): void {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const obj = raw ? (JSON.parse(raw) as PrefKeyStore) : {};
    const compositeKey = makeCompositeKey(spaceId, walletLower, notificationId);
    obj[compositeKey] = prefKey;
    localStorage.setItem(STORE_KEY, JSON.stringify(obj));
  } catch (error) {
    console.error('[setPrefKey] Error writing to localStorage:', error);
  }
}

/**
 * Clear preference key for a notification (optional cleanup)
 */
export function clearPrefKey(spaceId: string, walletLower: string, notificationId: string): void {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw) as PrefKeyStore;
    const compositeKey = makeCompositeKey(spaceId, walletLower, notificationId);
    delete obj[compositeKey];
    localStorage.setItem(STORE_KEY, JSON.stringify(obj));
  } catch (error) {
    console.error('[clearPrefKey] Error clearing from localStorage:', error);
  }
}

/**
 * Clear all preference keys (for testing/debugging)
 */
export function clearAllPrefKeys(): void {
  try {
    localStorage.removeItem(STORE_KEY);
  } catch (error) {
    console.error('[clearAllPrefKeys] Error clearing localStorage:', error);
  }
}


/**
 * Arkiv Explorer Link Helpers
 * 
 * Utilities for generating links to view entities on Arkiv Explorer.
 * All entities should have "View on Arkiv" links to teach users about blockchain.
 */

export const ARKIV_EXPLORER_BASE_URL = 'https://explorer.mendoza.hoodi.arkiv.network';

/**
 * Generate link to view transaction on Arkiv Explorer
 * 
 * @param txHash - Transaction hash
 * @returns Full URL to transaction on Arkiv Explorer
 */
export function getArkivExplorerTxUrl(txHash: string): string {
  return `${ARKIV_EXPLORER_BASE_URL}/tx/${txHash}`;
}

/**
 * Generate link to view entity on Arkiv Explorer
 * 
 * @param entityKey - Entity key
 * @returns Full URL to entity on Arkiv Explorer
 */
export function getArkivExplorerEntityUrl(entityKey: string): string {
  return `${ARKIV_EXPLORER_BASE_URL}/entity/${entityKey}`;
}

/**
 * "View on Arkiv" link component props
 */
export interface ViewOnArkivLinkProps {
  txHash?: string;
  entityKey?: string;
  label?: string;
  className?: string;
}

/**
 * Generate the appropriate Arkiv Explorer URL
 * Prefers entityKey (for entities), falls back to txHash (for transactions)
 * 
 * For entities, always use entityKey.
 * For transactions, explicitly pass only txHash.
 */
export function getArkivExplorerUrl(txHash?: string, entityKey?: string): string | null {
  // Prefer entityKey for entities (most common case)
  if (entityKey) {
    return getArkivExplorerEntityUrl(entityKey);
  }
  // Fall back to txHash only if no entityKey (for transaction-only links)
  if (txHash && txHash !== 'undefined') {
    return getArkivExplorerTxUrl(txHash);
  }
  return null;
}

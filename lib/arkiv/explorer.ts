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
 * Prefers txHash if available, falls back to entityKey
 */
export function getArkivExplorerUrl(txHash?: string, entityKey?: string): string | null {
  if (txHash && txHash !== 'undefined') {
    return getArkivExplorerTxUrl(txHash);
  }
  if (entityKey) {
    return getArkivExplorerEntityUrl(entityKey);
  }
  return null;
}

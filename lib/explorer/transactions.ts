/**
 * Transaction History Helper
 * 
 * Fetches transaction history for entities.
 * Handles different entity types appropriately.
 */

import { eq } from '@arkiv-network/sdk/query';
import { getPublicClient } from '@/lib/arkiv/client';
import { getTransactionMetadata } from '@/lib/explorer/txMeta';
import { getArkivExplorerTxUrl, getArkivExplorerEntityUrl } from '@/lib/arkiv/explorer';
import { listUserProfilesForWallet } from '@/lib/arkiv/profile';
import { SPACE_ID } from '@/lib/config';

export interface TransactionHistoryItem {
  txHash: string;
  blockNumber: string | null;
  blockTimestamp: number | null;
  status: 'success' | 'failed' | 'pending' | null;
  explorerTxUrl: string;
  explorerEntityUrl: string | null;
  createdAt: string;
  operation?: 'create' | 'update';
}

/**
 * Get transaction history for a profile (by wallet)
 * Profiles use Pattern B (update in place), so we query all profile entities for the wallet
 */
export async function getProfileTransactionHistory(wallet: string, spaceId?: string): Promise<TransactionHistoryItem[]> {
  try {
    const profiles = await listUserProfilesForWallet(wallet.toLowerCase(), spaceId || SPACE_ID);
    
    // Sort by createdAt descending (most recent first)
    const sortedProfiles = profiles.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    // Build transaction history items
    const transactions: TransactionHistoryItem[] = [];
    
    for (const profile of sortedProfiles) {
      if (!profile.txHash) continue;
      
      // Get transaction metadata
      const metadata = await getTransactionMetadata(profile.txHash);
      
      transactions.push({
        txHash: profile.txHash,
        blockNumber: metadata?.blockNumber?.toString() || null,
        blockTimestamp: metadata?.blockTimestamp || null,
        status: metadata?.status || null,
        explorerTxUrl: getArkivExplorerTxUrl(profile.txHash),
        explorerEntityUrl: getArkivExplorerEntityUrl(profile.key),
        createdAt: profile.createdAt || new Date().toISOString(),
        operation: transactions.length === 0 ? 'create' : 'update', // First is create, rest are updates
      });
    }

    return transactions;
  } catch (error) {
    console.error('[getProfileTransactionHistory] Error:', error);
    return [];
  }
}

/**
 * Get transaction history for an entity by querying *_txhash entities
 * Works for asks, offers, skills, and other entity types
 */
export async function getEntityTransactionHistory(
  entityKey: string,
  entityType: 'ask' | 'offer' | 'skill'
): Promise<TransactionHistoryItem[]> {
  try {
    const publicClient = getPublicClient();
    const txHashType = `${entityType}_txhash`;
    
    // Determine the attribute key based on entity type
    const entityKeyAttr = entityType === 'ask' ? 'askKey' : entityType === 'offer' ? 'offerKey' : 'skillKey';
    
    // Query all txhash entities for this entity key
    const result = await publicClient.buildQuery()
      .where(eq('type', txHashType))
      .where(eq(entityKeyAttr, entityKey))
      .withAttributes(true)
      .withPayload(true)
      .limit(100)
      .fetch();

    if (!result?.entities || !Array.isArray(result.entities)) {
      return [];
    }

    const transactions: TransactionHistoryItem[] = [];
    
    for (const txHashEntity of result.entities) {
      // Extract txHash from payload
      let txHash: string | null = null;
      try {
        if (txHashEntity.payload) {
          const decoded = txHashEntity.payload instanceof Uint8Array
            ? new TextDecoder().decode(txHashEntity.payload)
            : typeof txHashEntity.payload === 'string'
            ? txHashEntity.payload
            : JSON.stringify(txHashEntity.payload);
          const payload = JSON.parse(decoded);
          txHash = payload.txHash || null;
        }
      } catch (e) {
        console.error('[getEntityTransactionHistory] Error decoding payload:', e);
        continue;
      }

      if (!txHash) continue;

      // Get transaction metadata
      const metadata = await getTransactionMetadata(txHash);
      
      // Get createdAt from attributes
      const attrs = txHashEntity.attributes || {};
      const getAttr = (key: string): string => {
        if (Array.isArray(attrs)) {
          const attr = attrs.find((a: any) => a.key === key);
          return String(attr?.value || '');
        }
        return String(attrs[key] || '');
      };
      const createdAt = getAttr('createdAt') || new Date().toISOString();

      transactions.push({
        txHash,
        blockNumber: metadata?.blockNumber?.toString() || null,
        blockTimestamp: metadata?.blockTimestamp || null,
        status: metadata?.status || null,
        explorerTxUrl: getArkivExplorerTxUrl(txHash),
        explorerEntityUrl: getArkivExplorerEntityUrl(entityKey),
        createdAt,
        operation: transactions.length === 0 ? 'create' : 'update', // First is create, rest are updates
      });
    }

    // Sort by createdAt descending (most recent first)
    transactions.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    });

    return transactions;
  } catch (error) {
    console.error('[getEntityTransactionHistory] Error:', error);
    return [];
  }
}


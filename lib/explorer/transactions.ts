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
import { SPACE_ID, CURRENT_WALLET } from '@/lib/config';

export interface TransactionHistoryItem {
  txHash: string;
  blockNumber: string | null;
  blockTimestamp: number | null;
  status: 'success' | 'failed' | 'pending' | null;
  explorerTxUrl: string;
  explorerEntityUrl: string | null;
  createdAt: string;
  operation?: 'create' | 'update';
  // Additional context for human legibility (from tx_event entity)
  entityType?: 'profile' | 'ask' | 'offer' | 'skill';
  entityKey?: string;
  entityLabel?: string;
  wallet?: string;
  spaceId?: string;
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

/**
 * Get all app-recorded transaction events across all entity types
 *
 * Queries tx_event entities (single entity type for simple pagination).
 *
 * NOTE: This shows "app-recorded transaction events" (txhash log),
 * NOT all chain transactions. See scope definition in plan.
 *
 * @param params - Query parameters
 * @returns Transaction list with pagination cursor
 */
export async function getAllTransactions(params?: {
  spaceId?: string;
  spaceIds?: string[];
  entityType?: 'profile' | 'ask' | 'offer' | 'skill';
  status?: 'success' | 'failed' | 'pending';
  txHash?: string;
  wallet?: string;
  entityKey?: string;
  blockNumber?: string;
  limit?: number;
  cursor?: string;
}): Promise<{
  transactions: TransactionHistoryItem[];
  nextCursor: string | null;
  total: number;
}> {
  try {
    const publicClient = getPublicClient();
    const limit = Math.min(params?.limit || 50, 100); // Default 50, max 100

    // When spaceId is undefined (meaning "all spaces"), query all known spaces
    // Arkiv doesn't support OR queries, so we query each space separately and combine
    const allSpaceIds = ['beta-launch', 'local-dev', 'local-dev-seed', 'nsjan26', 'test'];
    const spaceIdsToQuery = params?.spaceId 
      ? [params.spaceId] 
      : params?.spaceIds || allSpaceIds;

    // Query each space separately and combine results
    // IMPORTANT: Create a new query builder for each space (query builders are stateful)
    const queryPromises = spaceIdsToQuery.map(spaceId => {
      const query = publicClient.buildQuery();
      let queryBuilder = query.where(eq('type', 'tx_event'));
      queryBuilder = queryBuilder.where(eq('space_id', spaceId));
      
      // Apply other filters to each query
      if (params?.entityType) {
        queryBuilder = queryBuilder.where(eq('entity_type', params.entityType));
      }
      if (params?.txHash) {
        queryBuilder = queryBuilder.where(eq('txhash', params.txHash));
      }
      if (params?.wallet) {
        queryBuilder = queryBuilder.where(eq('wallet', params.wallet.toLowerCase()));
      }
      if (params?.entityKey) {
        queryBuilder = queryBuilder.where(eq('entity_key', params.entityKey));
      }

      return queryBuilder
        .withAttributes(true)
        .withPayload(true)
        .limit(limit * 2) // Overfetch for status filtering
        .fetch();
    });

    const results = await Promise.all(queryPromises);
    
    // Combine all results into a single array
    // Defensive: validate result structure before accessing entities
    const allEntities = results.flatMap(result => {
      if (!result || !result.entities || !Array.isArray(result.entities)) {
        return [];
      }
      return result.entities;
    });

    if (!allEntities || allEntities.length === 0) {
      console.log(`[getAllTransactions] No entities returned from ${spaceIdsToQuery.length} space query(ies)`);
      return { transactions: [], nextCursor: null, total: 0 };
    }

    console.log(`[getAllTransactions] Found ${allEntities.length} tx_event entities from ${spaceIdsToQuery.length} space(s) before filtering`);

    // Handle cursor for pagination
    let startIndex = 0;
    if (params?.cursor) {
      try {
        const cursor: { i: number; v: string } = JSON.parse(
          Buffer.from(params.cursor, 'base64').toString()
        );
        startIndex = cursor.i;
      } catch {
        // Invalid cursor, start from beginning
      }
    }

    // Process entities and extract transaction data
    const allTransactions: TransactionHistoryItem[] = [];
    let filteredBySigner = 0;
    let missingTxHash = 0;

    for (const txEvent of allEntities) {
      // Extract attributes
      const attrs = txEvent.attributes || {};
      const getAttr = (key: string): string => {
        if (Array.isArray(attrs)) {
          const attr = attrs.find((a: any) => a.key === key);
          return String(attr?.value || '');
        }
        return String(attrs[key] || '');
      };

      // Filter by signer_wallet (client-side for backward compatibility)
      // CRITICAL: Only show transactions from our app's signing wallet (CURRENT_WALLET)
      // Include entities that either:
      // 1. Have signer_wallet = CURRENT_WALLET (new entities with metadata), OR
      // 2. Don't have signer_wallet at all (old entities created before we added this metadata)
      // This ensures backward compatibility while maintaining security
      if (!params?.wallet && CURRENT_WALLET) {
        const signerWallet = getAttr('signer_wallet');
        // If entity has signer_wallet, it must match CURRENT_WALLET
        // If entity doesn't have signer_wallet, include it (backward compatibility)
        if (signerWallet && signerWallet.toLowerCase() !== CURRENT_WALLET.toLowerCase()) {
          filteredBySigner++;
          continue; // Skip entities signed by different wallet
        }
        // If signerWallet is empty/missing, include it (old entity, backward compatibility)
      }

      const txHash = getAttr('txhash');
      if (!txHash) {
        missingTxHash++;
        continue;
      }

      const entityType = getAttr('entity_type') as 'profile' | 'ask' | 'offer' | 'skill' | '';
      const entityKey = getAttr('entity_key');
      const wallet = getAttr('wallet');
      const operation = getAttr('op') as 'create' | 'update' | 'write' | '';
      const createdAt = getAttr('created_at') || new Date().toISOString();
      const spaceId = getAttr('space_id');

      // Extract entity_label from payload
      let entityLabel: string | undefined;
      try {
        if (txEvent.payload) {
          const decoded = txEvent.payload instanceof Uint8Array
            ? new TextDecoder().decode(txEvent.payload)
            : typeof txEvent.payload === 'string'
            ? txEvent.payload
            : JSON.stringify(txEvent.payload);
          const payload = JSON.parse(decoded);
          entityLabel = payload.entity_label;
        }
      } catch (e) {
        // Ignore payload decode errors
      }

      // Build entity URL
      const explorerEntityUrl = entityKey ? getArkivExplorerEntityUrl(entityKey) : null;

      allTransactions.push({
        txHash,
        blockNumber: null, // Will be filled from metadata if needed
        blockTimestamp: null, // Will be filled from metadata if needed
        status: null, // Will be filled from metadata if needed
        explorerTxUrl: getArkivExplorerTxUrl(txHash),
        explorerEntityUrl,
        createdAt,
        operation: operation === 'create' ? 'create' : operation === 'update' ? 'update' : undefined,
        // Additional context for human legibility
        entityType: entityType || undefined,
        entityKey: entityKey || undefined,
        entityLabel,
        wallet: wallet || undefined,
        spaceId: spaceId || undefined,
      });
    }

    console.log(`[getAllTransactions] After filtering: ${allTransactions.length} transactions (filtered by signer: ${filteredBySigner}, missing txhash: ${missingTxHash})`);

    // Sort by createdAt descending (most recent first)
    allTransactions.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    });

    // Apply pagination first (before metadata fetch for efficiency)
    const paginatedForMetadata = allTransactions.slice(startIndex, startIndex + limit);

    // Fetch metadata for paginated transactions only (cap at limit)
    const metadataPromises = paginatedForMetadata.map(async (tx) => {
      const metadata = await getTransactionMetadata(tx.txHash);
      return {
        ...tx,
        blockNumber: metadata?.blockNumber?.toString() || null,
        blockTimestamp: metadata?.blockTimestamp || null,
        status: metadata?.status || null,
      };
    });

    let transactionsWithMetadata = await Promise.all(metadataPromises);

    // Apply status filter if provided (best-effort within page window)
    if (params?.status) {
      transactionsWithMetadata = transactionsWithMetadata.filter(
        (tx) => tx.status === params.status
      );
    }

    // Filter by blockNumber if provided (requires metadata, already fetched)
    if (params?.blockNumber) {
      transactionsWithMetadata = transactionsWithMetadata.filter(
        (tx) => tx.blockNumber === params.blockNumber
      );
    }

    // Generate next cursor
    // If we have more transactions in the full list beyond current page, there's a next page
    const hasMore = startIndex + limit < allTransactions.length;
    const nextCursor = hasMore
      ? Buffer.from(JSON.stringify({ i: startIndex + limit, v: '1' })).toString('base64')
      : null;

    return {
      transactions: transactionsWithMetadata,
      nextCursor,
      total: allTransactions.length, // Total before filtering (approximate)
    };
  } catch (error) {
    console.error('[getAllTransactions] Error:', error);
    return { transactions: [], nextCursor: null, total: 0 };
  }
}


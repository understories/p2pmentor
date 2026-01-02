/**
 * Transaction Event Entity
 * 
 * Creates tx_event entities for the explorer transaction feed.
 * This is an append-only log that records all app-recorded transaction events.
 * 
 * Pattern: Immutable log (Pattern A) - each transaction event is a new entity
 * 
 * Reference: refs/docs/explorer-all-transactions-display-plan.md
 */

import { getWalletClientFromPrivateKey } from './client';
import { SPACE_ID } from '@/lib/config';
import { handleTransactionWithTimeout } from './transaction-utils';

export type TxEventEntityType = 'profile' | 'ask' | 'offer' | 'skill';
export type TxEventOperation = 'create' | 'update' | 'write';

export interface CreateTxEventParams {
  txHash: string;
  entityType: TxEventEntityType;
  entityKey: string;
  wallet?: string; // Optional - some entities (like skills) may not have a wallet
  operation: TxEventOperation;
  entityLabel?: string; // Human-readable entity name/title (denormalized)
  privateKey: `0x${string}`;
  spaceId?: string;
}

/**
 * Create a tx_event entity
 * 
 * This records a transaction event for the explorer feed.
 * Should be called whenever a *_txhash entity is created.
 * 
 * @param params - Transaction event parameters
 * @returns Entity key and transaction hash (non-blocking, errors are logged but don't throw)
 */
export async function createTxEvent({
  txHash,
  entityType,
  entityKey,
  wallet,
  operation,
  entityLabel,
  privateKey,
  spaceId = SPACE_ID,
}: CreateTxEventParams): Promise<{ key: string; txHash: string } | null> {
  try {
    const walletClient = getWalletClientFromPrivateKey(privateKey);
    const enc = new TextEncoder();
    const createdAt = new Date().toISOString();

    // Map entityType to Arkiv entity type name
    const arkivEntityType = entityType === 'profile' ? 'user_profile' : entityType;

    // Build attributes (queryable fields)
    const attributes: Array<{ key: string; value: string }> = [
      { key: 'type', value: 'tx_event' },
      { key: 'txhash', value: txHash },
      { key: 'entity_type', value: entityType },
      { key: 'entity_key', value: entityKey },
      { key: 'space_id', value: spaceId },
      { key: 'op', value: operation },
      { key: 'created_at', value: createdAt },
    ];

    // Add wallet attribute if provided (some entities like skills may not have a wallet)
    if (wallet) {
      attributes.push({ key: 'wallet', value: wallet.toLowerCase() });
    }

    // Build payload (user-facing content)
    const payload = {
      txhash: txHash,
      entity_label: entityLabel || `${entityType}:${entityKey.slice(0, 8)}...`,
      createdAt,
    };

    // Create tx_event entity (non-blocking - errors are logged but don't throw)
    // This is best-effort - the main entity write already succeeded
    const result = await handleTransactionWithTimeout(async () => {
      return await walletClient.createEntity({
        payload: enc.encode(JSON.stringify(payload)),
        contentType: 'application/json',
        attributes,
        expiresIn: 31536000, // 1 year (same as main entities)
      });
    });

    return { key: result.entityKey, txHash: result.txHash };
  } catch (error: any) {
    // Log error but don't throw - tx_event creation is best-effort
    // The main entity write already succeeded, so we don't want to fail the whole operation
    console.warn('[createTxEvent] Failed to create tx_event entity:', {
      txHash,
      entityType,
      entityKey,
      error: error?.message,
    });
    return null;
  }
}


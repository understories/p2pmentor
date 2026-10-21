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
import { addSignerMetadata } from './signer-metadata';
import { createArkivEntity } from './write';

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
    const createdAt = new Date().toISOString();

    // Build attributes (queryable fields)
    // Add signer metadata (U1.x.2: Central Signer Metadata)
    // This tracks which wallet signed the tx_event entity creation (the signing wallet)
    const attributes = addSignerMetadata(
      {
        txhash: txHash,
        entity_type: entityType,
        entity_key: entityKey,
        space_id: spaceId,
        op: operation,
        created_at: createdAt,
        // Some entities (like skills) may not have a wallet
        wallet: wallet ? wallet.toLowerCase() : undefined,
      },
      privateKey
    );

    // Build payload (user-facing content)
    const payload = {
      txhash: txHash,
      entity_label: entityLabel || `${entityType}:${entityKey.slice(0, 8)}...`,
      createdAt,
    };

    // Create tx_event entity (non-blocking - errors are logged but don't throw)
    // This is best-effort - the main entity write already succeeded
    const result = await handleTransactionWithTimeout(async () => {
      return await createArkivEntity(walletClient, {
        type: 'tx_event',
        attributes,
        payload,
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

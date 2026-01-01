/**
 * Transaction metadata helper
 * 
 * Fetches transaction receipt and block info from the blockchain.
 * Uses ephemeral in-memory cache (safe because tx data is immutable).
 * 
 * Cache strategy:
 * - Success/fail transactions: 24h+ (immutable after finality)
 * - Pending transactions: 30s (may change)
 */

import { getPublicClient } from '@/lib/arkiv/client';
import { ARKIV_EXPLORER_BASE_URL } from '@/lib/arkiv/explorer';

export interface TransactionMetadata {
  txHash: string;
  blockNumber: bigint | null;
  blockTimestamp: number | null;
  status: 'success' | 'failed' | 'pending' | null;
}

/**
 * Ephemeral in-memory cache for transaction metadata
 * 
 * Key: txHash
 * Value: { metadata, expiresAt }
 */
interface CacheEntry {
  metadata: TransactionMetadata;
  expiresAt: number; // Unix timestamp in milliseconds
}

const txMetadataCache = new Map<string, CacheEntry>();

/**
 * Cache duration constants (in milliseconds)
 */
const CACHE_DURATION_SUCCESS = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_DURATION_PENDING = 30 * 1000; // 30 seconds

/**
 * Get cached transaction metadata
 */
function getCachedTxMetadata(txHash: string): TransactionMetadata | null {
  const entry = txMetadataCache.get(txHash);
  if (!entry) {
    return null;
  }

  // Check if cache entry has expired
  if (Date.now() > entry.expiresAt) {
    txMetadataCache.delete(txHash);
    return null;
  }

  return entry.metadata;
}

/**
 * Cache transaction metadata
 */
function cacheTxMetadata(
  txHash: string,
  metadata: TransactionMetadata,
  durationMs: number
): void {
  const expiresAt = Date.now() + durationMs;
  txMetadataCache.set(txHash, { metadata, expiresAt });
}

/**
 * Get transaction metadata from blockchain
 * 
 * @param txHash - Transaction hash (0x... format)
 * @returns Transaction metadata or null if not found
 */
export async function getTransactionMetadata(
  txHash: string
): Promise<TransactionMetadata | null> {
  // Check cache first
  const cached = getCachedTxMetadata(txHash);
  if (cached) {
    return cached;
  }

  try {
    const publicClient = getPublicClient();
    
    // Get transaction receipt
    const receipt = await publicClient.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });

    if (!receipt) {
      // Transaction not found or pending
      const pending: TransactionMetadata = {
        txHash,
        blockNumber: null,
        blockTimestamp: null,
        status: 'pending',
      };
      
      // Cache pending transactions for 30s
      cacheTxMetadata(txHash, pending, CACHE_DURATION_PENDING);
      return pending;
    }

    // Get block info for timestamp
    let blockTimestamp: number | null = null;
    try {
      const block = await publicClient.getBlock({
        blockNumber: receipt.blockNumber,
      });
      blockTimestamp = Number(block.timestamp);
    } catch (blockError) {
      // If block fetch fails, we still have blockNumber and status
      console.warn('[getTransactionMetadata] Failed to fetch block:', blockError);
    }

    const metadata: TransactionMetadata = {
      txHash,
      blockNumber: receipt.blockNumber,
      blockTimestamp,
      status: receipt.status === 'success' ? 'success' : 'failed',
    };

    // Cache success/fail transactions for 24h (immutable after finality)
    cacheTxMetadata(txHash, metadata, CACHE_DURATION_SUCCESS);
    return metadata;
  } catch (error: any) {
    // Handle various error cases
    if (
      error.message?.includes('not found') ||
      error.message?.includes('not be processed') ||
      error.message?.includes('Transaction not found')
    ) {
      // Transaction not found or pending
      const pending: TransactionMetadata = {
        txHash,
        blockNumber: null,
        blockTimestamp: null,
        status: 'pending',
      };
      
      // Cache pending for 30s
      cacheTxMetadata(txHash, pending, CACHE_DURATION_PENDING);
      return pending;
    }

    // Other errors - log and return null
    console.error('[getTransactionMetadata] Error:', error);
    return null;
  }
}

/**
 * Generate explorer URL for a transaction
 */
export function getExplorerTxUrl(txHash: string): string {
  return `${ARKIV_EXPLORER_BASE_URL}/tx/${txHash}`;
}


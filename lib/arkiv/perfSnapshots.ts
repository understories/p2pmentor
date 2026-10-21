/**
 * Performance Snapshot CRUD helpers
 *
 * Stores aggregated performance snapshots as Arkiv entities for historical tracking.
 * Enables comparison of performance over time as we iterate on query methods.
 *
 * Reference: Performance monitoring best practices
 */

import { eqAttr } from '@/lib/arkiv/schema';
import { arkivSelect, fetchAll, getAttr as readAttr } from '@/lib/arkiv/read';
import { getPublicClient, getWalletClientFromPrivateKey } from './client';
import { handleTransactionWithTimeout } from './transaction-utils';
import { createArkivEntity } from './write';
import { SPACE_ID } from '@/lib/config';

export type PerfSnapshot = {
  key: string;
  timestamp: string; // ISO timestamp
  operation: string; // e.g., 'buildNetworkGraphData'
  method: 'arkiv' | 'graphql' | 'both'; // Which method was actually tested (may differ from requested)
  arkivMetadata?: {
    blockHeight?: number; // Arkiv block height at snapshot time
    chainId?: number; // Chain ID (Arkiv testnet)
    timestamp: string; // ISO timestamp when metadata was captured
  };
  graphql?: {
    avgDurationMs: number;
    minDurationMs: number;
    maxDurationMs: number;
    avgPayloadBytes?: number;
    avgHttpRequests?: number;
    samples: number;
    pages?: Record<string, number>;
  };
  arkiv?: {
    avgDurationMs: number;
    minDurationMs: number;
    maxDurationMs: number;
    avgPayloadBytes?: number;
    avgHttpRequests?: number;
    samples: number;
    pages?: Record<string, number>;
  };
  pageLoadTimes?: {
    avgDurationMs: number;
    minDurationMs: number;
    maxDurationMs: number;
    total: number;
    successful: number;
  };
  createdAt: string;
  txHash?: string;
};

/**
 * Create a performance snapshot entity on Arkiv
 *
 * Stores aggregated performance data at a point in time.
 * Used for historical comparison and trend analysis.
 */
export async function createPerfSnapshot({
  snapshot,
  privateKey,
  spaceId = SPACE_ID,
}: {
  snapshot: Omit<PerfSnapshot, 'key' | 'txHash'>;
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const createdAt = snapshot.createdAt || new Date().toISOString();

  const payload = {
    timestamp: snapshot.timestamp,
    operation: snapshot.operation,
    method: snapshot.method,
    arkivMetadata: snapshot.arkivMetadata, // Include Arkiv RPC metadata
    graphql: snapshot.graphql,
    arkiv: snapshot.arkiv,
    pageLoadTimes: snapshot.pageLoadTimes,
    createdAt,
  };

  // Performance snapshots use the type default lifetime (see lib/arkiv/schema.ts)

  // Wrap in handleTransactionWithTimeout to handle receipt timeouts gracefully (same pattern as createDxMetric)
  const { entityKey, txHash } = await handleTransactionWithTimeout(async () => {
    return await createArkivEntity(walletClient, {
      type: 'perf_snapshot',
      attributes: {
        operation: snapshot.operation,
        method: snapshot.method,
        timestamp: snapshot.timestamp,
        space_id: spaceId,
        created_at: createdAt,
      },
      payload,
    });
  });

  // Store txHash in a separate entity for reliable querying
  // This can fail gracefully - the main entity is more important (same pattern as createDxMetric)
  try {
    await createArkivEntity(walletClient, {
      type: 'perf_snapshot_txhash',
      attributes: {
        snapshot_key: entityKey,
        operation: snapshot.operation,
        space_id: spaceId,
      },
      payload: { txHash },
    });
  } catch (error: any) {
    // If txHash entity creation fails but we have the main entity, log and continue
    // The main perf_snapshot entity is more important
    console.warn(
      '[perfSnapshots] Failed to create perf_snapshot_txhash entity, but snapshot was created:',
      error
    );
  }

  return { key: entityKey, txHash };
}

/**
 * List performance snapshots from Arkiv
 */
export async function listPerfSnapshots({
  operation,
  method,
  limit = 100,
  since,
}: {
  operation?: string;
  method?: 'arkiv' | 'graphql' | 'both';
  limit?: number;
  since?: string;
} = {}): Promise<PerfSnapshot[]> {
  try {
    const publicClient = getPublicClient();

    // Filter operation/method on the node when given (also re-checked client-side below)
    let snapshotQuery = arkivSelect('perf_snapshot', publicClient);
    if (operation) snapshotQuery = snapshotQuery.where(eqAttr('operation', operation));
    if (method) snapshotQuery = snapshotQuery.where(eqAttr('method', method));

    // Fetch snapshot entities and txHash entities in parallel
    const [result, txHashResult] = await Promise.all([
      fetchAll(snapshotQuery, limit || 100, publicClient),
      fetchAll(arkivSelect('perf_snapshot_txhash', publicClient), 1000, publicClient),
    ]);

    if (!result || !result.entities || !Array.isArray(result.entities)) {
      console.error('Invalid result from Arkiv query for perf snapshots:', result);
      return [];
    }

    // Build txHash map
    const txHashMap: Record<string, string> = {};
    if (txHashResult?.entities && Array.isArray(txHashResult.entities)) {
      txHashResult.entities.forEach((entity: any) => {
        const getAttr = (key: string): string => readAttr(entity, key);
        const snapshotKey = getAttr('snapshot_key');
        try {
          if (entity.payload) {
            const decoded =
              entity.payload instanceof Uint8Array
                ? new TextDecoder().decode(entity.payload)
                : typeof entity.payload === 'string'
                  ? entity.payload
                  : JSON.stringify(entity.payload);
            const payload = JSON.parse(decoded);
            if (payload.txHash && snapshotKey) {
              txHashMap[snapshotKey] = payload.txHash;
            }
          }
        } catch (e) {
          // Ignore decode errors
        }
      });
    }

    let snapshots = result.entities.map((entity: any) => {
      let payload: any = {};
      try {
        if (entity.payload) {
          const decoded =
            entity.payload instanceof Uint8Array
              ? new TextDecoder().decode(entity.payload)
              : typeof entity.payload === 'string'
                ? entity.payload
                : JSON.stringify(entity.payload);
          payload = JSON.parse(decoded);
        }
      } catch (e) {
        console.error('Error decoding perf snapshot payload:', e);
      }

      const getAttr = (key: string): string => readAttr(entity, key);

      return {
        key: entity.key,
        timestamp: payload.timestamp || getAttr('timestamp'),
        operation: payload.operation || getAttr('operation'),
        method: (payload.method || getAttr('method')) as 'arkiv' | 'graphql' | 'both',
        graphql: payload.graphql,
        arkiv: payload.arkiv,
        pageLoadTimes: payload.pageLoadTimes,
        createdAt: payload.createdAt || getAttr('created_at'),
        txHash: txHashMap[entity.key] || payload.txHash || entity.txHash || undefined,
      };
    });

    // Apply filters
    if (operation) {
      snapshots = snapshots.filter((s) => s.operation === operation);
    }
    if (method) {
      snapshots = snapshots.filter((s) => s.method === method);
    }
    if (since) {
      const sinceTime = new Date(since).getTime();
      snapshots = snapshots.filter((s) => new Date(s.timestamp).getTime() >= sinceTime);
    }

    // Sort by most recent first
    return snapshots.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch (error: any) {
    console.error('Error in listPerfSnapshots:', error);
    return [];
  }
}

/**
 * Get the most recent snapshot for an operation
 */
export async function getLatestSnapshot(operation: string): Promise<PerfSnapshot | null> {
  const snapshots = await listPerfSnapshots({ operation, limit: 1 });
  return snapshots.length > 0 ? snapshots[0] : null;
}

/**
 * Check if a new snapshot should be created (last one > 12 hours old)
 */
export async function shouldCreateSnapshot(operation: string): Promise<boolean> {
  const latest = await getLatestSnapshot(operation);
  if (!latest) return true; // No snapshots yet, create one

  const lastSnapshotTime = new Date(latest.timestamp).getTime();
  const now = Date.now();
  const hoursSinceLastSnapshot = (now - lastSnapshotTime) / (1000 * 60 * 60);

  return hoursSinceLastSnapshot >= 12; // Create if >= 12 hours old
}

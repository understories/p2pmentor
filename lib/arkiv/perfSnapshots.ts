/**
 * Performance Snapshot CRUD helpers
 * 
 * Stores aggregated performance snapshots as Arkiv entities for historical tracking.
 * Enables comparison of performance over time as we iterate on query methods.
 * 
 * Reference: Performance monitoring best practices
 */

import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient, getWalletClientFromPrivateKey } from "./client";
import { handleTransactionWithTimeout } from "./transaction-utils";
import { SPACE_ID } from "@/lib/config";

export type PerfSnapshot = {
  key: string;
  timestamp: string; // ISO timestamp
  operation: string; // e.g., 'buildNetworkGraphData'
  method: 'arkiv' | 'graphql' | 'both'; // Which method was actually tested (may differ from requested)
  arkivMetadata?: {
    blockHeight?: number; // Arkiv block height at snapshot time
    chainId?: number; // Chain ID (Mendoza testnet)
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
}

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
  const enc = new TextEncoder();
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

  // Performance snapshots should persist long-term (1 year) for historical analysis
  const expiresIn = 31536000; // 1 year in seconds

  // Wrap in handleTransactionWithTimeout to handle receipt timeouts gracefully (same pattern as createDxMetric)
  const { entityKey, txHash } = await handleTransactionWithTimeout(async () => {
    return await walletClient.createEntity({
      payload: enc.encode(JSON.stringify(payload)),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'perf_snapshot' },
        { key: 'operation', value: snapshot.operation },
        { key: 'method', value: snapshot.method },
        { key: 'timestamp', value: snapshot.timestamp },
        { key: 'spaceId', value: spaceId },
        { key: 'createdAt', value: createdAt },
      ],
      expiresIn,
    });
  });

  // Store txHash in a separate entity for reliable querying
  // This can fail gracefully - the main entity is more important (same pattern as createDxMetric)
  try {
    await walletClient.createEntity({
      payload: enc.encode(JSON.stringify({ txHash })),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'perf_snapshot_txhash' },
        { key: 'snapshotKey', value: entityKey },
        { key: 'operation', value: snapshot.operation },
        { key: 'spaceId', value: spaceId },
      ],
      expiresIn,
    });
  } catch (error: any) {
    // If txHash entity creation fails but we have the main entity, log and continue
    // The main perf_snapshot entity is more important
    console.warn('[perfSnapshots] Failed to create perf_snapshot_txhash entity, but snapshot was created:', error);
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
    
    // Fetch snapshot entities and txHash entities in parallel
    const [result, txHashResult] = await Promise.all([
      publicClient.buildQuery()
        .where(eq('type', 'perf_snapshot'))
        .withAttributes(true)
        .withPayload(true)
        .limit(limit || 100)
        .fetch(),
      publicClient.buildQuery()
        .where(eq('type', 'perf_snapshot_txhash'))
        .withAttributes(true)
        .withPayload(true)
        .fetch(),
    ]);

    if (!result || !result.entities || !Array.isArray(result.entities)) {
      console.error('Invalid result from Arkiv query for perf snapshots:', result);
      return [];
    }

    // Build txHash map
    const txHashMap: Record<string, string> = {};
    if (txHashResult?.entities && Array.isArray(txHashResult.entities)) {
      txHashResult.entities.forEach((entity: any) => {
        const attrs = entity.attributes || {};
        const getAttr = (key: string): string => {
          if (Array.isArray(attrs)) {
            const attr = attrs.find((a: any) => a.key === key);
            return String(attr?.value || '');
          }
          return String(attrs[key] || '');
        };
        const snapshotKey = getAttr('snapshotKey');
        try {
          if (entity.payload) {
            const decoded = entity.payload instanceof Uint8Array
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
          const decoded = entity.payload instanceof Uint8Array
            ? new TextDecoder().decode(entity.payload)
            : typeof entity.payload === 'string'
            ? entity.payload
            : JSON.stringify(entity.payload);
          payload = JSON.parse(decoded);
        }
      } catch (e) {
        console.error('Error decoding perf snapshot payload:', e);
      }

      const attrs = entity.attributes || {};
      const getAttr = (key: string): string => {
        if (Array.isArray(attrs)) {
          const attr = attrs.find((a: any) => a.key === key);
          return String(attr?.value || '');
        }
        return String(attrs[key] || '');
      };

      return {
        key: entity.key,
        timestamp: payload.timestamp || getAttr('timestamp'),
        operation: payload.operation || getAttr('operation'),
        method: (payload.method || getAttr('method')) as 'arkiv' | 'graphql' | 'both',
        graphql: payload.graphql,
        arkiv: payload.arkiv,
        pageLoadTimes: payload.pageLoadTimes,
        createdAt: payload.createdAt || getAttr('createdAt'),
        txHash: txHashMap[entity.key] || payload.txHash || entity.txHash || undefined,
      };
    });

    // Apply filters
    if (operation) {
      snapshots = snapshots.filter(s => s.operation === operation);
    }
    if (method) {
      snapshots = snapshots.filter(s => s.method === method);
    }
    if (since) {
      const sinceTime = new Date(since).getTime();
      snapshots = snapshots.filter(s => new Date(s.timestamp).getTime() >= sinceTime);
    }

    // Sort by most recent first
    return snapshots.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
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


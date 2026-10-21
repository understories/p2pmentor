/**
 * DX Metrics CRUD helpers
 *
 * Stores performance metrics as Arkiv entities for verifiable, on-chain tracking.
 * This allows us to demonstrate real performance differences between JSON-RPC and GraphQL.
 *
 * Reference: refs/docs/sprint2.md Section 2.3
 */

import { MAX_ATTR_STRING_BYTES } from '@/lib/arkiv/schema';
import { arkivSelect, fetchAll, getAttr as readAttr } from '@/lib/arkiv/read';
import { getPublicClient, getWalletClientFromPrivateKey } from './client';
import { handleTransactionWithTimeout } from './transaction-utils';
import { createArkivEntity } from './write';
import type { PerfSample } from '@/lib/metrics/perf';
import { SPACE_ID } from '@/lib/config';

/** Short string for an attribute, or undefined when it exceeds the attribute limit (kept in payload) */
const attrIfFits = (value?: string): string | undefined =>
  value && new TextEncoder().encode(value).length <= MAX_ATTR_STRING_BYTES ? value : undefined;

export type DxMetric = {
  key: string;
  source: 'graphql' | 'arkiv';
  operation: string;
  route?: string;
  durationMs: number;
  payloadBytes?: number;
  httpRequests?: number;
  status?: 'success' | 'failure';
  errorType?: string;
  usedFallback?: boolean;
  createdAt: string;
  txHash?: string;
};

/**
 * Create a DX metric entity on Arkiv
 *
 * Stores performance sample as a verifiable Arkiv entity.
 * This allows us to track and verify performance claims on-chain.
 */
export async function createDxMetric({
  sample,
  privateKey,
  spaceId = SPACE_ID,
}: {
  sample: PerfSample;
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const createdAt = sample.createdAt || new Date().toISOString();

  const payload = {
    durationMs: sample.durationMs,
    payloadBytes: sample.payloadBytes,
    httpRequests: sample.httpRequests,
    status: sample.status || 'success',
    errorType: sample.errorType || undefined,
    usedFallback: sample.usedFallback || false,
    route: sample.route || undefined,
    createdAt,
  };

  // DX metrics use the type default lifetime (see lib/arkiv/schema.ts)

  // Wrap in handleTransactionWithTimeout to handle receipt timeouts gracefully
  const { entityKey, txHash } = await handleTransactionWithTimeout(async () => {
    return await createArkivEntity(walletClient, {
      type: 'dx_metric',
      attributes: {
        source: sample.source,
        operation: sample.operation,
        route: attrIfFits(sample.route), // Full route is also in the payload
        duration_ms: String(sample.durationMs),
        status: sample.status || 'success',
        payload_bytes: sample.payloadBytes ? String(sample.payloadBytes) : undefined,
        http_requests: sample.httpRequests ? String(sample.httpRequests) : undefined,
        error_type: sample.errorType,
        used_fallback: String(sample.usedFallback || false),
        space_id: spaceId,
        created_at: createdAt,
      },
      payload,
    });
  });

  // Store txHash in a separate entity for reliable querying
  // This can fail gracefully - the main entity is more important
  try {
    await createArkivEntity(walletClient, {
      type: 'dx_metric_txhash',
      attributes: {
        metric_key: entityKey,
        source: sample.source,
        operation: sample.operation,
        space_id: spaceId,
      },
      payload: { txHash },
    });
  } catch (error: any) {
    // If txHash entity creation fails but we have the main entity, log and continue
    // The main dx_metric entity is more important
    console.warn('Failed to create dx_metric_txhash entity, but metric was created:', error);
  }

  return { key: entityKey, txHash };
}

/**
 * List DX metrics from Arkiv
 */
export async function listDxMetrics({
  source,
  operation,
  route,
  limit = 100,
  since,
}: {
  source?: 'graphql' | 'arkiv';
  operation?: string;
  route?: string;
  limit?: number;
  since?: string;
} = {}): Promise<DxMetric[]> {
  try {
    const publicClient = getPublicClient();

    // Fetch metric entities and txHash entities in parallel
    const [result, txHashResult] = await Promise.all([
      fetchAll(arkivSelect('dx_metric', publicClient), limit || 100, publicClient),
      fetchAll(arkivSelect('dx_metric_txhash', publicClient), 1000, publicClient),
    ]);

    if (!result || !result.entities || !Array.isArray(result.entities)) {
      console.error('Invalid result from Arkiv query for dx_metrics:', result);
      return [];
    }

    // Build txHash map
    const txHashMap: Record<string, string> = {};
    if (txHashResult?.entities && Array.isArray(txHashResult.entities)) {
      txHashResult.entities.forEach((entity: any) => {
        const getAttr = (key: string): string => readAttr(entity, key);
        const metricKey = getAttr('metric_key');
        try {
          if (entity.payload) {
            const decoded =
              entity.payload instanceof Uint8Array
                ? new TextDecoder().decode(entity.payload)
                : typeof entity.payload === 'string'
                  ? entity.payload
                  : JSON.stringify(entity.payload);
            const payload = JSON.parse(decoded);
            if (payload.txHash && metricKey) {
              txHashMap[metricKey] = payload.txHash;
            }
          }
        } catch (e) {
          // Ignore decode errors
        }
      });
    }

    let metrics = result.entities.map((entity: any) => {
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
        console.error('Error decoding dx_metric payload:', e);
      }

      const getAttr = (key: string): string => readAttr(entity, key);

      return {
        key: entity.key,
        source: getAttr('source') as 'graphql' | 'arkiv',
        operation: getAttr('operation'),
        route: payload.route || getAttr('route') || undefined,
        durationMs: payload.durationMs || parseInt(getAttr('duration_ms'), 10),
        payloadBytes:
          payload.payloadBytes ||
          (getAttr('payload_bytes') ? parseInt(getAttr('payload_bytes'), 10) : undefined),
        httpRequests:
          payload.httpRequests ||
          (getAttr('http_requests') ? parseInt(getAttr('http_requests'), 10) : undefined),
        status: (getAttr('status') || payload.status || 'success') as 'success' | 'failure',
        errorType: getAttr('error_type') || payload.errorType || undefined,
        usedFallback: getAttr('used_fallback') === 'true' || payload.usedFallback === true,
        createdAt: getAttr('created_at') || payload.createdAt,
        txHash: txHashMap[entity.key] || payload.txHash || entity.txHash || undefined,
      };
    });

    // Apply filters
    if (source) {
      metrics = metrics.filter((m) => m.source === source);
    }
    if (operation) {
      metrics = metrics.filter((m) => m.operation === operation);
    }
    if (route) {
      metrics = metrics.filter((m) => m.route === route);
    }
    if (since) {
      const sinceTime = new Date(since).getTime();
      metrics = metrics.filter((m) => new Date(m.createdAt).getTime() >= sinceTime);
    }

    // Sort by most recent first
    return metrics.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error: any) {
    console.error('Error in listDxMetrics:', error);
    return [];
  }
}

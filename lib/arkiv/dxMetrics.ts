/**
 * DX Metrics CRUD helpers
 * 
 * Stores performance metrics as Arkiv entities for verifiable, on-chain tracking.
 * This allows us to demonstrate real performance differences between JSON-RPC and GraphQL.
 * 
 * Reference: refs/docs/sprint2.md Section 2.3
 */

import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient, getWalletClientFromPrivateKey } from "./client";
import { handleTransactionWithTimeout } from "./transaction-utils";
import type { PerfSample } from "@/lib/metrics/perf";

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
}

/**
 * Create a DX metric entity on Arkiv
 * 
 * Stores performance sample as a verifiable Arkiv entity.
 * This allows us to track and verify performance claims on-chain.
 */
export async function createDxMetric({
  sample,
  privateKey,
  spaceId = 'local-dev',
}: {
  sample: PerfSample;
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();
  const createdAt = sample.createdAt || new Date().toISOString();

  const payload = {
    durationMs: sample.durationMs,
    payloadBytes: sample.payloadBytes,
    httpRequests: sample.httpRequests,
    status: sample.status || 'success',
    errorType: sample.errorType || undefined,
    usedFallback: sample.usedFallback || false,
    createdAt,
  };

  // DX metrics should persist for analysis (90 days)
  const expiresIn = 7776000; // 90 days in seconds

  // Wrap in handleTransactionWithTimeout to handle receipt timeouts gracefully
  const { entityKey, txHash } = await handleTransactionWithTimeout(async () => {
    return await walletClient.createEntity({
      payload: enc.encode(JSON.stringify(payload)),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'dx_metric' },
        { key: 'source', value: sample.source },
        { key: 'operation', value: sample.operation },
        { key: 'route', value: sample.route || '' },
        { key: 'durationMs', value: String(sample.durationMs) },
        { key: 'status', value: sample.status || 'success' },
        ...(sample.payloadBytes ? [{ key: 'payloadBytes', value: String(sample.payloadBytes) }] : []),
        ...(sample.httpRequests ? [{ key: 'httpRequests', value: String(sample.httpRequests) }] : []),
        ...(sample.errorType ? [{ key: 'errorType', value: sample.errorType }] : []),
        { key: 'usedFallback', value: String(sample.usedFallback || false) },
        { key: 'spaceId', value: spaceId },
        { key: 'createdAt', value: createdAt },
      ],
      expiresIn,
    });
  });

  // Store txHash in a separate entity for reliable querying
  // This can fail gracefully - the main entity is more important
  try {
    await walletClient.createEntity({
      payload: enc.encode(JSON.stringify({ txHash })),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'dx_metric_txhash' },
        { key: 'metricKey', value: entityKey },
        { key: 'source', value: sample.source },
        { key: 'operation', value: sample.operation },
        { key: 'spaceId', value: spaceId },
      ],
      expiresIn,
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
      publicClient.buildQuery()
        .where(eq('type', 'dx_metric'))
        .withAttributes(true)
        .withPayload(true)
        .limit(limit || 100)
        .fetch(),
      publicClient.buildQuery()
        .where(eq('type', 'dx_metric_txhash'))
        .withAttributes(true)
        .withPayload(true)
        .fetch(),
    ]);

    if (!result || !result.entities || !Array.isArray(result.entities)) {
      console.error('Invalid result from Arkiv query for dx_metrics:', result);
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
        const metricKey = getAttr('metricKey');
        try {
          if (entity.payload) {
            const decoded = entity.payload instanceof Uint8Array
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
          const decoded = entity.payload instanceof Uint8Array
            ? new TextDecoder().decode(entity.payload)
            : typeof entity.payload === 'string'
            ? entity.payload
            : JSON.stringify(entity.payload);
          payload = JSON.parse(decoded);
        }
      } catch (e) {
        console.error('Error decoding dx_metric payload:', e);
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
        source: getAttr('source') as 'graphql' | 'arkiv',
        operation: getAttr('operation'),
        route: getAttr('route') || undefined,
        durationMs: payload.durationMs || parseInt(getAttr('durationMs'), 10),
        payloadBytes: payload.payloadBytes || (getAttr('payloadBytes') ? parseInt(getAttr('payloadBytes'), 10) : undefined),
        httpRequests: payload.httpRequests || (getAttr('httpRequests') ? parseInt(getAttr('httpRequests'), 10) : undefined),
        status: (getAttr('status') || payload.status || 'success') as 'success' | 'failure',
        errorType: getAttr('errorType') || payload.errorType || undefined,
        usedFallback: getAttr('usedFallback') === 'true' || payload.usedFallback === true,
        createdAt: getAttr('createdAt') || payload.createdAt,
        txHash: txHashMap[entity.key] || payload.txHash || entity.txHash || undefined,
      };
    });

    // Apply filters
    if (source) {
      metrics = metrics.filter(m => m.source === source);
    }
    if (operation) {
      metrics = metrics.filter(m => m.operation === operation);
    }
    if (route) {
      metrics = metrics.filter(m => m.route === route);
    }
    if (since) {
      const sinceTime = new Date(since).getTime();
      metrics = metrics.filter(m => new Date(m.createdAt).getTime() >= sinceTime);
    }

    // Sort by most recent first
    return metrics.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error: any) {
    console.error('Error in listDxMetrics:', error);
    return [];
  }
}


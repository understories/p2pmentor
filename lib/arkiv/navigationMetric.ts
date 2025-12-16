/**
 * Navigation Metric CRUD helpers
 *
 * Stores aggregated navigation metrics as Arkiv entities.
 * Privacy-preserving: no PII, only aggregated counts.
 *
 * Reference: refs/click-navigation-tracking-plan.md
 */

import { eq } from '@arkiv-network/sdk/query';
import { getPublicClient, getWalletClientFromPrivateKey } from './client';
import { handleTransactionWithTimeout } from './transaction-utils';
import type { NavigationMetric } from '@/lib/metrics/navigation';

export type NavigationMetricEntity = {
  key: string;
  aggregates: Array<{
    pattern: string;
    count: number;
  }>;
  page: string;
  createdAt: string;
  txHash?: string;
};

/**
 * Create a navigation metric entity on Arkiv
 */
export async function createNavigationMetric({
  metric,
  privateKey,
  spaceId = 'local-dev',
}: {
  metric: NavigationMetric;
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();
  const createdAt = metric.createdAt || new Date().toISOString();

  const payload = {
    aggregates: metric.aggregates,
    createdAt,
  };

  // Navigation metrics persist for 90 days (same as client perf metrics)
  const expiresIn = 7776000; // 90 days in seconds

  const { entityKey, txHash } = await handleTransactionWithTimeout(async () => {
    return await walletClient.createEntity({
      payload: enc.encode(JSON.stringify(payload)),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'navigation_metric' },
        { key: 'page', value: metric.page },
        { key: 'spaceId', value: spaceId },
        { key: 'createdAt', value: createdAt },
      ],
      expiresIn,
    });
  });

  // Store txHash in separate entity for reliable querying
  try {
    await handleTransactionWithTimeout(async () => {
      return await walletClient.createEntity({
        payload: enc.encode(JSON.stringify({ txHash })),
        contentType: 'application/json',
        attributes: [
          { key: 'type', value: 'navigation_metric_txhash' },
          { key: 'metricKey', value: entityKey },
          { key: 'txHash', value: txHash },
          { key: 'spaceId', value: spaceId },
          { key: 'createdAt', value: createdAt },
        ],
        expiresIn,
      });
    });
  } catch (error: any) {
    // If txHash entity creation fails, log but don't fail the main entity creation
    console.warn('[createNavigationMetric] Failed to create txhash entity:', error);
  }

  return { key: entityKey, txHash };
}

/**
 * List navigation metrics from Arkiv
 */
export async function listNavigationMetrics({
  page,
  limit = 100,
  since,
}: {
  page?: string;
  limit?: number;
  since?: string;
} = {}): Promise<NavigationMetricEntity[]> {
  try {
    const publicClient = getPublicClient();

    // Fetch metric entities and txHash entities in parallel
    const [result, txHashResult] = await Promise.all([
      publicClient.buildQuery()
        .where(eq('type', 'navigation_metric'))
        .withAttributes(true)
        .withPayload(true)
        .limit(limit || 100)
        .fetch(),
      publicClient.buildQuery()
        .where(eq('type', 'navigation_metric_txhash'))
        .withAttributes(true)
        .withPayload(true)
        .fetch(),
    ]);

    if (!result || !result.entities || !Array.isArray(result.entities)) {
      console.error('Invalid result from Arkiv query for navigation_metrics:', result);
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
        if (metricKey) {
          try {
            const payload = entity.payload instanceof Uint8Array
              ? new TextDecoder().decode(entity.payload)
              : typeof entity.payload === 'string'
              ? entity.payload
              : JSON.stringify(entity.payload);
            const decoded = JSON.parse(payload);
            if (decoded.txHash) {
              txHashMap[metricKey] = decoded.txHash;
            }
          } catch (e) {
            console.error('Error decoding txHash payload:', e);
          }
        }
      });
    }

    // Parse entities
    const metrics: NavigationMetricEntity[] = [];
    result.entities.forEach((entity: any) => {
      try {
        const attrs = entity.attributes || {};
        const getAttr = (key: string): string => {
          if (Array.isArray(attrs)) {
            const attr = attrs.find((a: any) => a.key === key);
            return String(attr?.value || '');
          }
          return String(attrs[key] || '');
        };

        const entityPage = getAttr('page');
        const createdAt = getAttr('createdAt');

        // Filter by page if specified
        if (page && entityPage !== page) {
          return;
        }

        // Filter by since date if specified
        if (since && createdAt < since) {
          return;
        }

        // Parse payload
        let payload: any = {};
        if (entity.payload) {
          const decoded = entity.payload instanceof Uint8Array
            ? new TextDecoder().decode(entity.payload)
            : typeof entity.payload === 'string'
            ? entity.payload
            : JSON.stringify(entity.payload);
          payload = JSON.parse(decoded);
        }

        const aggregates = payload.aggregates || [];
        if (!Array.isArray(aggregates)) {
          return;
        }

        metrics.push({
          key: entity.key,
          aggregates,
          page: entityPage,
          createdAt,
          txHash: txHashMap[entity.key],
        });
      } catch (e) {
        console.error('Error parsing navigation metric entity:', e);
      }
    });

    // Sort by createdAt descending (most recent first)
    metrics.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return metrics;
  } catch (error: any) {
    console.error('[listNavigationMetrics] Error:', error);
    return [];
  }
}


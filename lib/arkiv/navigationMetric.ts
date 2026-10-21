/**
 * Navigation Metric CRUD helpers
 *
 * Stores aggregated navigation metrics as Arkiv entities.
 * Privacy-preserving: no PII, only aggregated counts.
 *
 * Reference: refs/click-navigation-tracking-plan.md
 */

import { MAX_ATTR_STRING_BYTES } from '@/lib/arkiv/schema';
import { arkivSelect, fetchAll, getAttr as readAttr } from '@/lib/arkiv/read';
import { getPublicClient, getWalletClientFromPrivateKey } from './client';
import { handleTransactionWithTimeout } from './transaction-utils';
import { createArkivEntity } from './write';
import type { NavigationMetric } from '@/lib/metrics/navigation';
import { SPACE_ID } from '@/lib/config';

/** Short string for an attribute, or undefined when it exceeds the attribute limit (kept in payload) */
const attrIfFits = (value?: string): string | undefined =>
  value && new TextEncoder().encode(value).length <= MAX_ATTR_STRING_BYTES ? value : undefined;

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
  spaceId = SPACE_ID,
}: {
  metric: NavigationMetric;
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const createdAt = metric.createdAt || new Date().toISOString();

  const payload = {
    aggregates: metric.aggregates,
    page: metric.page,
    createdAt,
  };

  // Navigation metrics use the type default lifetime (see lib/arkiv/schema.ts)

  const { entityKey, txHash } = await handleTransactionWithTimeout(async () => {
    return await createArkivEntity(walletClient, {
      type: 'navigation_metric',
      attributes: {
        page: attrIfFits(metric.page), // Full page is also in the payload
        space_id: spaceId,
        created_at: createdAt,
      },
      payload,
    });
  });

  // Store txHash in separate entity for reliable querying
  try {
    await handleTransactionWithTimeout(async () => {
      return await createArkivEntity(walletClient, {
        type: 'navigation_metric_txhash',
        attributes: {
          metric_key: entityKey,
          tx_hash: txHash,
          space_id: spaceId,
          created_at: createdAt,
        },
        payload: { txHash },
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
      fetchAll(arkivSelect('navigation_metric', publicClient), limit || 100, publicClient),
      fetchAll(arkivSelect('navigation_metric_txhash', publicClient), 1000, publicClient),
    ]);

    if (!result || !result.entities || !Array.isArray(result.entities)) {
      console.error('Invalid result from Arkiv query for navigation_metrics:', result);
      return [];
    }

    // Build txHash map
    const txHashMap: Record<string, string> = {};
    if (txHashResult?.entities && Array.isArray(txHashResult.entities)) {
      txHashResult.entities.forEach((entity: any) => {
        const getAttr = (key: string): string => readAttr(entity, key);
        const metricKey = getAttr('metric_key');
        if (metricKey) {
          try {
            const payload =
              entity.payload instanceof Uint8Array
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
        const getAttr = (key: string): string => readAttr(entity, key);

        // Parse payload
        let payload: any = {};
        if (entity.payload) {
          const decoded =
            entity.payload instanceof Uint8Array
              ? new TextDecoder().decode(entity.payload)
              : typeof entity.payload === 'string'
                ? entity.payload
                : JSON.stringify(entity.payload);
          payload = JSON.parse(decoded);
        }

        const entityPage = payload.page || getAttr('page');
        const createdAt = getAttr('created_at');

        // Filter by page if specified
        if (page && entityPage !== page) {
          return;
        }

        // Filter by since date if specified
        if (since && createdAt < since) {
          return;
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

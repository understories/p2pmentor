/**
 * Navigation Metric CRUD helpers
 *
 * Stores aggregated navigation metrics as Arkiv entities.
 * Privacy-preserving: no PII, only aggregated counts.
 *
 * Reference: refs/click-navigation-tracking-plan.md
 */

import { getWalletClientFromPrivateKey } from './client';
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


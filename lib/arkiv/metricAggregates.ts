/**
 * Metric Aggregates CRUD helpers
 *
 * Stores pre-computed metric aggregates (percentiles, daily/weekly summaries) as Arkiv entities.
 * These are computed by Vercel Cron jobs and stored for fast dashboard loading.
 *
 * Reference: refs/doc/beta_metrics_QUESTIONS.md Questions 2, 4, 11
 */

import { MAX_ATTR_STRING_BYTES } from '@/lib/arkiv/schema';
import { arkivSelect, fetchAll, getAttr as readAttr } from '@/lib/arkiv/read';
import { getPublicClient, getWalletClientFromPrivateKey } from './client';
import { handleTransactionWithTimeout } from './transaction-utils';
import { createArkivEntity } from './write';
import { listDxMetrics } from './dxMetrics';
import { listClientPerfMetrics } from './clientPerfMetric';
import { SPACE_ID } from '@/lib/config';

/** Short string for an attribute, or undefined when it exceeds the attribute limit (kept in payload) */
const attrIfFits = (value?: string): string | undefined =>
  value && new TextEncoder().encode(value).length <= MAX_ATTR_STRING_BYTES ? value : undefined;

export type PercentileMetrics = {
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  avg: number;
  min: number;
  max: number;
  sampleCount: number;
};

export type DailyMetricAggregate = {
  key: string;
  date: string; // YYYY-MM-DD
  period: 'daily' | 'weekly';
  operation?: string;
  source?: 'graphql' | 'arkiv';
  route?: string;
  percentiles?: PercentileMetrics;
  errorRate?: number; // Percentage of failures
  fallbackRate?: number; // Percentage of fallbacks
  totalRequests?: number;
  successfulRequests?: number;
  failedRequests?: number;
  createdAt: string;
  txHash?: string;
};

/**
 * Calculate percentiles from an array of numbers
 */
export function calculatePercentiles(values: number[]): PercentileMetrics {
  if (values.length === 0) {
    return {
      p50: 0,
      p90: 0,
      p95: 0,
      p99: 0,
      avg: 0,
      min: 0,
      max: 0,
      sampleCount: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const len = sorted.length;

  const percentile = (p: number) => {
    const index = Math.ceil((p / 100) * len) - 1;
    return sorted[Math.max(0, Math.min(index, len - 1))];
  };

  return {
    p50: percentile(50),
    p90: percentile(90),
    p95: percentile(95),
    p99: percentile(99),
    avg: values.reduce((a, b) => a + b, 0) / values.length,
    min: sorted[0],
    max: sorted[len - 1],
    sampleCount: len,
  };
}

/**
 * Create a daily metric aggregate entity on Arkiv
 */
export async function createMetricAggregate({
  aggregate,
  privateKey,
  spaceId = SPACE_ID,
}: {
  aggregate: Omit<DailyMetricAggregate, 'key' | 'txHash'>;
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const createdAt = aggregate.createdAt || new Date().toISOString();

  const payload = {
    date: aggregate.date,
    period: aggregate.period,
    operation: aggregate.operation,
    source: aggregate.source,
    route: aggregate.route,
    percentiles: aggregate.percentiles,
    errorRate: aggregate.errorRate,
    fallbackRate: aggregate.fallbackRate,
    totalRequests: aggregate.totalRequests,
    successfulRequests: aggregate.successfulRequests,
    failedRequests: aggregate.failedRequests,
    createdAt,
  };

  // Aggregates use the type default lifetime (see lib/arkiv/schema.ts)

  const { entityKey, txHash } = await handleTransactionWithTimeout(async () => {
    return await createArkivEntity(walletClient, {
      type: 'metric_aggregate',
      attributes: {
        date: aggregate.date,
        period: aggregate.period,
        operation: aggregate.operation,
        source: aggregate.source,
        route: attrIfFits(aggregate.route), // Full route is also in the payload
        space_id: spaceId,
        created_at: createdAt,
      },
      payload,
    });
  });

  // Store txHash
  try {
    await createArkivEntity(walletClient, {
      type: 'metric_aggregate_txhash',
      attributes: {
        aggregate_key: entityKey,
        date: aggregate.date,
        period: aggregate.period,
        space_id: spaceId,
      },
      payload: { txHash },
    });
  } catch (error: any) {
    console.warn('[metricAggregates] Failed to create txhash entity:', error);
  }

  return { key: entityKey, txHash };
}

/**
 * List metric aggregates from Arkiv
 */
export async function listMetricAggregates({
  date,
  period,
  operation,
  source,
  route,
  limit = 100,
}: {
  date?: string;
  period?: 'daily' | 'weekly';
  operation?: string;
  source?: 'graphql' | 'arkiv';
  route?: string;
  limit?: number;
} = {}): Promise<DailyMetricAggregate[]> {
  try {
    const publicClient = getPublicClient();

    const [result, txHashResult] = await Promise.all([
      fetchAll(arkivSelect('metric_aggregate', publicClient), limit || 100, publicClient),
      fetchAll(arkivSelect('metric_aggregate_txhash', publicClient), 1000, publicClient),
    ]);

    if (!result?.entities || !Array.isArray(result.entities)) {
      return [];
    }

    // Build txHash map
    const txHashMap: Record<string, string> = {};
    if (txHashResult?.entities && Array.isArray(txHashResult.entities)) {
      txHashResult.entities.forEach((entity: any) => {
        const getAttr = (key: string): string => readAttr(entity, key);
        const aggregateKey = getAttr('aggregate_key');
        try {
          if (entity.payload) {
            const decoded =
              entity.payload instanceof Uint8Array
                ? new TextDecoder().decode(entity.payload)
                : typeof entity.payload === 'string'
                  ? entity.payload
                  : JSON.stringify(entity.payload);
            const payload = JSON.parse(decoded);
            if (payload.txHash && aggregateKey) {
              txHashMap[aggregateKey] = payload.txHash;
            }
          }
        } catch (e) {
          // Ignore decode errors
        }
      });
    }

    let aggregates = result.entities.map((entity: any) => {
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
        console.error('[listMetricAggregates] Error decoding payload:', e);
      }

      const getAttr = (key: string): string => readAttr(entity, key);

      return {
        key: entity.key,
        date: getAttr('date') || payload.date,
        period: (getAttr('period') || payload.period || 'daily') as 'daily' | 'weekly',
        operation: getAttr('operation') || payload.operation || undefined,
        source: (getAttr('source') || payload.source) as 'graphql' | 'arkiv' | undefined,
        route: payload.route || getAttr('route') || undefined,
        percentiles: payload.percentiles || undefined,
        errorRate: payload.errorRate || undefined,
        fallbackRate: payload.fallbackRate || undefined,
        totalRequests: payload.totalRequests || undefined,
        successfulRequests: payload.successfulRequests || undefined,
        failedRequests: payload.failedRequests || undefined,
        createdAt: getAttr('created_at') || payload.createdAt,
        txHash: txHashMap[entity.key] || payload.txHash || undefined,
      };
    });

    // Apply filters
    if (date) {
      aggregates = aggregates.filter((a) => a.date === date);
    }
    if (period) {
      aggregates = aggregates.filter((a) => a.period === period);
    }
    if (operation) {
      aggregates = aggregates.filter((a) => a.operation === operation);
    }
    if (source) {
      aggregates = aggregates.filter((a) => a.source === source);
    }
    if (route) {
      aggregates = aggregates.filter((a) => a.route === route);
    }

    return aggregates.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error: any) {
    console.error('[listMetricAggregates] Error:', error);
    return [];
  }
}

/**
 * Compute daily aggregates from DX metrics
 */
export async function computeDailyAggregates(
  date: string
): Promise<Omit<DailyMetricAggregate, 'key' | 'txHash'>[]> {
  // Get all metrics for the date
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const since = startOfDay.toISOString();
  const metrics = await listDxMetrics({ since, limit: 1000 });

  // Filter to date range
  const dayMetrics = metrics.filter((m) => {
    const metricDate = new Date(m.createdAt);
    return metricDate >= startOfDay && metricDate <= endOfDay;
  });

  // Group by operation, source, route
  const groups = new Map<string, typeof dayMetrics>();

  dayMetrics.forEach((metric) => {
    const key = `${metric.operation || 'unknown'}:${metric.source || 'unknown'}:${metric.route || 'unknown'}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(metric);
  });

  const aggregates: Omit<DailyMetricAggregate, 'key' | 'txHash'>[] = [];

  groups.forEach((groupMetrics, key) => {
    const [operation, source, route] = key.split(':');
    const durations = groupMetrics.map((m) => m.durationMs);
    const percentiles = calculatePercentiles(durations);

    const totalRequests = groupMetrics.length;
    const successfulRequests = groupMetrics.filter((m) => m.status === 'success').length;
    const failedRequests = totalRequests - successfulRequests;
    const fallbackCount = groupMetrics.filter((m) => m.usedFallback).length;

    aggregates.push({
      date,
      period: 'daily',
      operation: operation !== 'unknown' ? operation : undefined,
      source: source !== 'unknown' ? (source as 'graphql' | 'arkiv') : undefined,
      route: route !== 'unknown' ? route : undefined,
      percentiles,
      errorRate: totalRequests > 0 ? (failedRequests / totalRequests) * 100 : 0,
      fallbackRate: totalRequests > 0 ? (fallbackCount / totalRequests) * 100 : 0,
      totalRequests,
      successfulRequests,
      failedRequests,
      createdAt: new Date().toISOString(),
    });
  });

  return aggregates;
}

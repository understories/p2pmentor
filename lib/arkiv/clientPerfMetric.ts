/**
 * Client Performance Metric CRUD helpers
 *
 * Stores client-side performance metrics as Arkiv entities.
 * Privacy-preserving: no PII, only performance data.
 *
 * Reference: refs/doc/beta_metrics_QUESTIONS.md Question 5
 */

import { MAX_ATTR_STRING_BYTES } from '@/lib/arkiv/schema';
import { arkivSelect, fetchAll, getAttr as readAttr } from '@/lib/arkiv/read';
import { getPublicClient, getWalletClientFromPrivateKey } from './client';
import { handleTransactionWithTimeout } from './transaction-utils';
import { createArkivEntity } from './write';
import type { ClientPerfMetric } from '@/lib/metrics/clientPerf';
import { SPACE_ID } from '@/lib/config';

/** Short string for an attribute, or undefined when it exceeds the attribute limit (kept in payload) */
const attrIfFits = (value?: string): string | undefined =>
  value && new TextEncoder().encode(value).length <= MAX_ATTR_STRING_BYTES ? value : undefined;

export type ClientPerfMetricEntity = {
  key: string;
  ttfb?: number;
  fcp?: number;
  lcp?: number;
  fid?: number;
  cls?: number;
  tti?: number;
  renderTime?: number;
  page: string;
  userAgent?: string;
  createdAt: string;
  txHash?: string;
};

/**
 * Create a client performance metric entity on Arkiv
 */
export async function createClientPerfMetric({
  metric,
  privateKey,
  spaceId = SPACE_ID,
}: {
  metric: ClientPerfMetric;
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const createdAt = metric.createdAt || new Date().toISOString();

  const payload = {
    ttfb: metric.ttfb,
    fcp: metric.fcp,
    lcp: metric.lcp,
    fid: metric.fid,
    cls: metric.cls,
    tti: metric.tti,
    renderTime: metric.renderTime,
    userAgent: metric.userAgent, // Payload only (free text, often > 128 bytes)
    page: metric.page,
    createdAt,
  };

  // Client perf metrics use the type default lifetime (see lib/arkiv/schema.ts)

  const { entityKey, txHash } = await handleTransactionWithTimeout(async () => {
    return await createArkivEntity(walletClient, {
      type: 'client_perf_metric',
      attributes: {
        page: attrIfFits(metric.page), // Full page is also in the payload
        ttfb: metric.ttfb ? String(metric.ttfb) : undefined,
        fcp: metric.fcp ? String(metric.fcp) : undefined,
        lcp: metric.lcp ? String(metric.lcp) : undefined,
        fid: metric.fid ? String(metric.fid) : undefined,
        cls: metric.cls ? String(metric.cls) : undefined,
        tti: metric.tti ? String(metric.tti) : undefined,
        render_time: metric.renderTime ? String(metric.renderTime) : undefined,
        space_id: spaceId,
        created_at: createdAt,
      },
      payload,
    });
  });

  // Store txHash in separate entity
  try {
    await createArkivEntity(walletClient, {
      type: 'client_perf_metric_txhash',
      attributes: {
        metric_key: entityKey,
        page: attrIfFits(metric.page),
        space_id: spaceId,
      },
      payload: { txHash },
    });
  } catch (error: any) {
    console.warn('[clientPerfMetric] Failed to create txhash entity:', error);
  }

  return { key: entityKey, txHash };
}

/**
 * List client performance metrics from Arkiv
 */
export async function listClientPerfMetrics({
  page,
  limit = 100,
  since,
}: {
  page?: string;
  limit?: number;
  since?: string;
} = {}): Promise<ClientPerfMetricEntity[]> {
  try {
    const publicClient = getPublicClient();

    const [result, txHashResult] = await Promise.all([
      fetchAll(arkivSelect('client_perf_metric', publicClient), limit || 100, publicClient),
      fetchAll(arkivSelect('client_perf_metric_txhash', publicClient), 1000, publicClient),
    ]);

    if (!result?.entities || !Array.isArray(result.entities)) {
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
        console.error('[listClientPerfMetrics] Error decoding payload:', e);
      }

      const getAttr = (key: string): string => readAttr(entity, key);

      return {
        key: entity.key,
        page: payload.page || getAttr('page'),
        ttfb: payload.ttfb || (getAttr('ttfb') ? parseInt(getAttr('ttfb'), 10) : undefined),
        fcp: payload.fcp || (getAttr('fcp') ? parseInt(getAttr('fcp'), 10) : undefined),
        lcp: payload.lcp || (getAttr('lcp') ? parseInt(getAttr('lcp'), 10) : undefined),
        fid: payload.fid || (getAttr('fid') ? parseInt(getAttr('fid'), 10) : undefined),
        cls: payload.cls || (getAttr('cls') ? parseFloat(getAttr('cls')) : undefined),
        tti: payload.tti || (getAttr('tti') ? parseInt(getAttr('tti'), 10) : undefined),
        renderTime:
          payload.renderTime ||
          (getAttr('render_time') ? parseInt(getAttr('render_time'), 10) : undefined),
        userAgent: payload.userAgent || getAttr('user_agent') || undefined,
        createdAt: getAttr('created_at') || payload.createdAt,
        txHash: txHashMap[entity.key] || payload.txHash || undefined,
      };
    });

    // Apply filters
    if (page) {
      metrics = metrics.filter((m) => m.page === page);
    }
    if (since) {
      const sinceTime = new Date(since).getTime();
      metrics = metrics.filter((m) => new Date(m.createdAt).getTime() >= sinceTime);
    }

    return metrics.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error: any) {
    console.error('[listClientPerfMetrics] Error:', error);
    return [];
  }
}

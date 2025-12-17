/**
 * Client Performance Metric CRUD helpers
 * 
 * Stores client-side performance metrics as Arkiv entities.
 * Privacy-preserving: no PII, only performance data.
 * 
 * Reference: refs/doc/beta_metrics_QUESTIONS.md Question 5
 */

import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient, getWalletClientFromPrivateKey } from "./client";
import { handleTransactionWithTimeout } from "./transaction-utils";
import type { ClientPerfMetric } from "@/lib/metrics/clientPerf";
import { SPACE_ID } from "@/lib/config";

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
  const enc = new TextEncoder();
  const createdAt = metric.createdAt || new Date().toISOString();

  const payload = {
    ttfb: metric.ttfb,
    fcp: metric.fcp,
    lcp: metric.lcp,
    fid: metric.fid,
    cls: metric.cls,
    tti: metric.tti,
    renderTime: metric.renderTime,
    userAgent: metric.userAgent,
    createdAt,
  };

  // Client perf metrics persist for analysis (90 days)
  const expiresIn = 7776000; // 90 days in seconds

  const { entityKey, txHash } = await handleTransactionWithTimeout(async () => {
    return await walletClient.createEntity({
      payload: enc.encode(JSON.stringify(payload)),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'client_perf_metric' },
        { key: 'page', value: metric.page },
        ...(metric.ttfb ? [{ key: 'ttfb', value: String(metric.ttfb) }] : []),
        ...(metric.fcp ? [{ key: 'fcp', value: String(metric.fcp) }] : []),
        ...(metric.lcp ? [{ key: 'lcp', value: String(metric.lcp) }] : []),
        ...(metric.fid ? [{ key: 'fid', value: String(metric.fid) }] : []),
        ...(metric.cls ? [{ key: 'cls', value: String(metric.cls) }] : []),
        ...(metric.tti ? [{ key: 'tti', value: String(metric.tti) }] : []),
        ...(metric.renderTime ? [{ key: 'renderTime', value: String(metric.renderTime) }] : []),
        ...(metric.userAgent ? [{ key: 'userAgent', value: metric.userAgent }] : []),
        { key: 'spaceId', value: spaceId },
        { key: 'createdAt', value: createdAt },
      ],
      expiresIn,
    });
  });

  // Store txHash in separate entity
  try {
    await walletClient.createEntity({
      payload: enc.encode(JSON.stringify({ txHash })),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'client_perf_metric_txhash' },
        { key: 'metricKey', value: entityKey },
        { key: 'page', value: metric.page },
        { key: 'spaceId', value: spaceId },
      ],
      expiresIn,
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
      publicClient.buildQuery()
        .where(eq('type', 'client_perf_metric'))
        .withAttributes(true)
        .withPayload(true)
        .limit(limit || 100)
        .fetch(),
      publicClient.buildQuery()
        .where(eq('type', 'client_perf_metric_txhash'))
        .withAttributes(true)
        .withPayload(true)
        .fetch(),
    ]);

    if (!result?.entities || !Array.isArray(result.entities)) {
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
        console.error('[listClientPerfMetrics] Error decoding payload:', e);
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
        page: getAttr('page'),
        ttfb: payload.ttfb || (getAttr('ttfb') ? parseInt(getAttr('ttfb'), 10) : undefined),
        fcp: payload.fcp || (getAttr('fcp') ? parseInt(getAttr('fcp'), 10) : undefined),
        lcp: payload.lcp || (getAttr('lcp') ? parseInt(getAttr('lcp'), 10) : undefined),
        fid: payload.fid || (getAttr('fid') ? parseInt(getAttr('fid'), 10) : undefined),
        cls: payload.cls || (getAttr('cls') ? parseFloat(getAttr('cls')) : undefined),
        tti: payload.tti || (getAttr('tti') ? parseInt(getAttr('tti'), 10) : undefined),
        renderTime: payload.renderTime || (getAttr('renderTime') ? parseInt(getAttr('renderTime'), 10) : undefined),
        userAgent: getAttr('userAgent') || payload.userAgent || undefined,
        createdAt: getAttr('createdAt') || payload.createdAt,
        txHash: txHashMap[entity.key] || payload.txHash || undefined,
      };
    });

    // Apply filters
    if (page) {
      metrics = metrics.filter(m => m.page === page);
    }
    if (since) {
      const sinceTime = new Date(since).getTime();
      metrics = metrics.filter(m => new Date(m.createdAt).getTime() >= sinceTime);
    }

    return metrics.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error: any) {
    console.error('[listClientPerfMetrics] Error:', error);
    return [];
  }
}

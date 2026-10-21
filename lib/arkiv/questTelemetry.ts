/**
 * Quest Telemetry Entity Functions
 *
 * Lightweight, non-blocking telemetry for quest failures and drop-off tracking.
 * Stores error logs and step view/completion counts as Arkiv entities.
 * Never stores PII — only error metadata and aggregate counts.
 *
 * Week 4 (Feb 22-29) - Reliability pass
 */

import { eqAttr } from '@/lib/arkiv/schema';
import { arkivSelect, fetchAll, getAttr as readAttr, parsePayload } from '@/lib/arkiv/read';
import { getPublicClient, getWalletClientFromPrivateKey } from './client';
import { handleTransactionWithTimeout } from './transaction-utils';
import { createArkivEntity } from './write';
import { SPACE_ID } from '../config';

export type TelemetryEventType =
  | 'step_completion_error'
  | 'step_view'
  | 'step_drop_off'
  | 'quiz_failure'
  | 'transaction_retry'
  | 'indexer_lag';

export interface QuestTelemetryEvent {
  key: string;
  eventType: TelemetryEventType;
  questId: string;
  stepId: string;
  errorType?: string;
  errorMessage?: string;
  retryCount?: number;
  lagMs?: number;
  createdAt: string;
  spaceId: string;
  txHash?: string;
}

/**
 * Log a telemetry event (fire-and-forget)
 *
 * Entity key: auto-generated (append-only events, no stable key needed)
 * Also creates a parallel quest_telemetry_txhash entity for observability.
 *
 * This is intentionally non-blocking — telemetry should never
 * slow down or break the user experience.
 */
export async function logTelemetryEvent({
  eventType,
  questId,
  stepId,
  errorType,
  errorMessage,
  retryCount,
  lagMs,
  privateKey,
  spaceId = SPACE_ID,
  ttlSeconds = 7776000, // 90 days (operational telemetry, shorter than the type default)
}: {
  eventType: TelemetryEventType;
  questId: string;
  stepId: string;
  errorType?: string;
  errorMessage?: string;
  retryCount?: number;
  lagMs?: number;
  privateKey: `0x${string}`;
  spaceId?: string;
  ttlSeconds?: number;
}): Promise<{ key: string; txHash: string } | null> {
  const finalSpaceId = spaceId || SPACE_ID;
  const createdAt = new Date().toISOString();
  const timestamp = Date.now();

  try {
    const walletClient = getWalletClientFromPrivateKey(privateKey);

    const attributes = {
      event_type: eventType,
      quest_id: questId,
      step_id: stepId,
      space_id: finalSpaceId,
      created_at: createdAt,
    };

    const sanitizedMessage = errorMessage
      ? errorMessage.slice(0, 200).replace(/0x[a-fA-F0-9]{20,}/g, '0x...')
      : undefined;

    const payload = {
      errorType: errorType || undefined,
      errorMessage: sanitizedMessage,
      retryCount: retryCount || undefined,
      lagMs: lagMs || undefined,
      timestamp,
    };

    const result = await handleTransactionWithTimeout(async () => {
      return await createArkivEntity(walletClient, {
        type: 'quest_telemetry',
        attributes,
        payload,
        lifetimeSeconds: ttlSeconds,
      });
    });

    const { entityKey, txHash } = result;

    createArkivEntity(walletClient, {
      type: 'quest_telemetry_txhash',
      attributes: {
        entity_key: entityKey,
        space_id: finalSpaceId,
      },
      payload: { txHash },
      lifetimeSeconds: ttlSeconds,
    }).catch((err: any) => {
      console.warn('[logTelemetryEvent] txHash entity failed (non-blocking):', err?.message);
    });

    return { key: entityKey, txHash };
  } catch (error: any) {
    console.warn('[logTelemetryEvent] Non-blocking telemetry failed:', error?.message);
    return null;
  }
}

/**
 * Get telemetry events for analysis
 */
export async function getTelemetryEvents({
  eventType,
  questId,
  stepId,
  spaceId = SPACE_ID,
  limit = 100,
}: {
  eventType?: TelemetryEventType;
  questId?: string;
  stepId?: string;
  spaceId?: string;
  limit?: number;
}): Promise<QuestTelemetryEvent[]> {
  const finalSpaceId = spaceId || SPACE_ID;

  try {
    const publicClient = getPublicClient();
    const query = arkivSelect('quest_telemetry', publicClient);

    let queryBuilder = query.where(eqAttr('space_id', finalSpaceId));

    if (eventType) {
      queryBuilder = queryBuilder.where(eqAttr('event_type', eventType));
    }
    if (questId) {
      queryBuilder = queryBuilder.where(eqAttr('quest_id', questId));
    }
    if (stepId) {
      queryBuilder = queryBuilder.where(eqAttr('step_id', stepId));
    }

    const result = await fetchAll(queryBuilder, limit, publicClient);

    if (!result || !result.entities || !Array.isArray(result.entities)) {
      return [];
    }

    return result.entities.map((entity: any) => {
      const getAttr = (key: string) => readAttr(entity, key);

      const payload: any = parsePayload(entity);

      return {
        key: entity.key || '',
        eventType: (getAttr('event_type') || 'step_completion_error') as TelemetryEventType,
        questId: getAttr('quest_id') || '',
        stepId: getAttr('step_id') || '',
        errorType: payload.errorType,
        errorMessage: payload.errorMessage,
        retryCount: payload.retryCount,
        lagMs: payload.lagMs,
        createdAt: getAttr('created_at') || '',
        spaceId: getAttr('space_id') || finalSpaceId,
        txHash: entity.txHash,
      };
    });
  } catch (error: any) {
    console.error('[getTelemetryEvents] Query failed:', error);
    return [];
  }
}

/**
 * Calculate drop-off rate for a quest
 *
 * Compares step_view events to step completions to identify
 * where learners are getting stuck or losing interest.
 */
export async function getDropOffAnalysis({
  questId,
  spaceId = SPACE_ID,
}: {
  questId: string;
  spaceId?: string;
}): Promise<
  {
    stepId: string;
    views: number;
    completions: number;
    dropOffRate: number;
  }[]
> {
  const finalSpaceId = spaceId || SPACE_ID;

  try {
    const [viewEvents, completionErrors] = await Promise.all([
      getTelemetryEvents({ eventType: 'step_view', questId, spaceId: finalSpaceId, limit: 500 }),
      getTelemetryEvents({
        eventType: 'step_drop_off',
        questId,
        spaceId: finalSpaceId,
        limit: 500,
      }),
    ]);

    const viewsByStep = new Map<string, number>();
    const dropOffsByStep = new Map<string, number>();

    for (const event of viewEvents) {
      viewsByStep.set(event.stepId, (viewsByStep.get(event.stepId) || 0) + 1);
    }
    for (const event of completionErrors) {
      dropOffsByStep.set(event.stepId, (dropOffsByStep.get(event.stepId) || 0) + 1);
    }

    const allSteps = new Set([...viewsByStep.keys(), ...dropOffsByStep.keys()]);

    return Array.from(allSteps).map((stepId) => {
      const views = viewsByStep.get(stepId) || 0;
      const dropOffs = dropOffsByStep.get(stepId) || 0;
      const completions = views - dropOffs;
      return {
        stepId,
        views,
        completions: Math.max(0, completions),
        dropOffRate: views > 0 ? dropOffs / views : 0,
      };
    });
  } catch (error: any) {
    console.error('[getDropOffAnalysis] Error:', error);
    return [];
  }
}

/**
 * List all telemetry events across all quests (for explorer).
 */
export async function listAllTelemetryEvents({
  spaceIds,
  limit = 1000,
}: {
  spaceIds?: string[];
  limit?: number;
} = {}): Promise<QuestTelemetryEvent[]> {
  try {
    const publicClient = getPublicClient();

    const fetchForSpace = async (spaceId: string): Promise<QuestTelemetryEvent[]> => {
      const result = await fetchAll(
        arkivSelect('quest_telemetry', publicClient).where(eqAttr('space_id', spaceId)),
        limit,
        publicClient
      );

      if (!result?.entities || !Array.isArray(result.entities)) return [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const getAttr = (entity: any, key: string): string => readAttr(entity, key);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return result.entities.map((entity: any) => ({
        key: entity.key,
        eventType: getAttr(entity, 'event_type') as TelemetryEventType,
        questId: getAttr(entity, 'quest_id'),
        stepId: getAttr(entity, 'step_id'),
        createdAt: getAttr(entity, 'created_at'),
        spaceId: getAttr(entity, 'space_id'),
        txHash: entity.txHash || undefined,
      }));
    };

    if (spaceIds && spaceIds.length > 0) {
      const results = await Promise.all(spaceIds.map(fetchForSpace));
      return results.flat();
    }

    return await fetchForSpace(SPACE_ID);
  } catch (error: unknown) {
    console.error('[listAllTelemetryEvents] Error:', error);
    return [];
  }
}

/**
 * Asks CRUD helpers
 *
 * "I am learning" - users post what they want to learn
 *
 * Based on mentor-graph implementation.
 *
 * Reference: refs/mentor-graph/src/arkiv/asks.ts
 */

import { PROJECT, eqAttr } from '@/lib/arkiv/schema';
import { arkivSelect, fetchAll, getAttr as readAttr, getEntityByKey } from '@/lib/arkiv/read';
import { getPublicClient, getWalletClientFromPrivateKey } from './client';
import { handleTransactionWithTimeout } from './transaction-utils';
import { addSignerMetadata } from './signer-metadata';
import { createArkivEntity } from './write';
import { SPACE_ID } from '@/lib/config';

export const ASK_TTL_SECONDS = 604800; // 1 week default

export type Ask = {
  key: string;
  wallet: string;
  skill: string; // Legacy: kept for backward compatibility
  skill_id?: string; // New: reference to Skill entity (preferred for beta)
  skill_label?: string; // Derived from Skill entity (readonly, convenience)
  spaceId: string;
  createdAt: string;
  status: string;
  message: string;
  ttlSeconds: number;
  txHash?: string;
};

/**
 * Create an ask (I am learning)
 *
 * @param data - Ask data
 * @param privateKey - Private key for signing
 * @returns Entity key and transaction hash
 */
export async function createAsk({
  wallet,
  skill, // Legacy: kept for backward compatibility
  skill_id, // New: reference to Skill entity (preferred for beta)
  skill_label, // Derived from Skill entity (readonly, convenience)
  message,
  privateKey,
  expiresIn,
}: {
  wallet: string;
  skill?: string; // Legacy: optional if skill_id provided
  skill_id?: string; // New: preferred for beta
  skill_label?: string; // Derived from Skill entity
  message: string;
  privateKey: `0x${string}`;
  expiresIn?: number;
}): Promise<{ key: string; txHash: string }> {
  // Validation: require either skill (legacy) or skill_id (beta)
  if (!skill && !skill_id) {
    throw new Error('Either skill (legacy) or skill_id (beta) must be provided');
  }

  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const spaceId = SPACE_ID;
  const status = 'open';
  const createdAt = new Date().toISOString();
  // Use expiresIn if provided and valid, otherwise use default
  const ttlRaw =
    expiresIn !== undefined && expiresIn !== null && typeof expiresIn === 'number' && expiresIn > 0
      ? expiresIn
      : ASK_TTL_SECONDS;
  const ttl = Math.floor(ttlRaw);

  // Attributes: short, queryable fields (skill fields: legacy for compatibility, new for beta)
  // Add signer metadata (U1.x.2: Central Signer Metadata)
  const attributes = addSignerMetadata(
    {
      wallet: wallet.toLowerCase(),
      space_id: spaceId,
      created_at: createdAt,
      status,
      ttl_seconds: String(ttl),
      skill,
      skill_id,
      skill_label,
    },
    privateKey
  );

  const result = await handleTransactionWithTimeout(async () => {
    return await createArkivEntity(walletClient, {
      type: 'ask',
      attributes,
      payload: { message },
      lifetimeSeconds: ttl,
    });
  });

  const { entityKey, txHash } = result;

  // Structured logging (U1.x.1: Explorer Independence)
  const { logEntityWrite } = await import('./write-logging');
  logEntityWrite({
    entityType: 'ask',
    entityKey,
    txHash,
    wallet: wallet.toLowerCase(),
    timestamp: createdAt,
    operation: 'create',
    spaceId,
  });

  // Create separate txhash entity (like mentor-graph)
  // Don't wait for this one - it's optional metadata
  createArkivEntity(walletClient, {
    type: 'ask_txhash',
    attributes: {
      ask_key: entityKey,
      wallet: wallet.toLowerCase(),
      space_id: spaceId,
    },
    payload: { txHash },
    lifetimeSeconds: ttl,
  }).catch((error: any) => {
    console.warn('[createAsk] Failed to create ask_txhash entity:', error);
  });

  // Create tx_event entity (non-blocking, best-effort)
  const { createTxEvent } = await import('./txEvent');
  const entityLabel = skill_label || skill || message.substring(0, 50);
  createTxEvent({
    txHash,
    entityType: 'ask',
    entityKey,
    wallet: wallet.toLowerCase(),
    operation: 'create',
    entityLabel,
    privateKey,
    spaceId,
  }).catch((error: any) => {
    console.warn('[createAsk] Failed to create tx_event:', error);
  });

  return { key: entityKey, txHash };
}

/**
 * List all open asks
 *
 * @param params - Optional filters (skill, spaceId, spaceIds)
 * @returns Array of asks
 */
export async function listAsks(params?: {
  skill?: string;
  spaceId?: string;
  spaceIds?: string[];
  limit?: number;
  includeExpired?: boolean;
}): Promise<Ask[]> {
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

  try {
    const publicClient = getPublicClient();
    const query = arkivSelect(undefined, publicClient);
    const limit = params?.limit ?? 500; // raise limit so expired/historical entries can be fetched
    let queryBuilder = query.where(eqAttr('type', 'ask')).where(eqAttr('status', 'open'));

    // Support multiple spaceIds (builder mode) or single spaceId
    if (params?.spaceIds && params.spaceIds.length > 0) {
      // Query all, filter client-side (OR queries are not used here)
    } else {
      // Use provided spaceId or default to SPACE_ID from config
      const spaceId = params?.spaceId || SPACE_ID;
      queryBuilder = queryBuilder.where(eqAttr('space_id', spaceId));
    }

    let result: any = null;
    let txHashResult: any = null;

    try {
      [result, txHashResult] = await Promise.all([
        fetchAll(queryBuilder, limit, publicClient),
        fetchAll(
          arkivSelect(undefined, publicClient).where(eqAttr('type', 'ask_txhash')),
          limit,
          publicClient
        ),
      ]);
    } catch (fetchError: any) {
      console.error('[listAsks] Arkiv query failed:', {
        message: fetchError?.message,
        stack: fetchError?.stack,
        error: fetchError,
      });
      return []; // Return empty array on query failure
    }

    // Defensive check: ensure result and entities exist
    if (!result || !result.entities || !Array.isArray(result.entities)) {
      console.warn('[listAsks] Invalid result structure, returning empty array', {
        result: result
          ? {
              hasEntities: !!result.entities,
              entitiesType: typeof result.entities,
              entitiesIsArray: Array.isArray(result.entities),
            }
          : 'null/undefined',
      });
      return [];
    }

    const txHashMap: Record<string, string> = {};
    const txHashEntities = txHashResult?.entities || [];
    txHashEntities.forEach((entity: any) => {
      const getAttr = (key: string): string => readAttr(entity, key);
      const askKey = getAttr('ask_key');
      if (askKey) {
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
          console.error('Error decoding txHash payload:', e);
        }
        if (payload.txHash) {
          txHashMap[askKey] = payload.txHash;
        }
      }
    });

    let asks = (result.entities || []).map((entity: any) => {
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
        console.error('Error decoding payload:', e);
      }

      const getAttr = (key: string): string => readAttr(entity, key);

      // Get TTL from attributes (stored when created), fallback to default for backward compatibility
      const ttlSecondsAttr = getAttr('ttl_seconds');
      const ttlSeconds = ttlSecondsAttr ? parseInt(ttlSecondsAttr, 10) : ASK_TTL_SECONDS;

      return {
        key: entity.key,
        wallet: getAttr('wallet') || payload.wallet || '',
        skill: getAttr('skill') || payload.skill || '', // Legacy: kept for backward compatibility
        skill_id: getAttr('skill_id') || payload.skill_id || undefined, // New: preferred for beta
        skill_label: getAttr('skill_label') || payload.skill_label || undefined, // Derived from Skill entity
        spaceId: getAttr('space_id') || payload.spaceId || SPACE_ID, // Use SPACE_ID from config as fallback (entities should always have spaceId)
        createdAt: getAttr('created_at') || payload.createdAt || '',
        status: getAttr('status') || payload.status || 'open',
        message: payload.message || '',
        ttlSeconds: isNaN(ttlSeconds) ? ASK_TTL_SECONDS : ttlSeconds, // Ensure valid number
        txHash:
          txHashMap[entity.key] ||
          getAttr('tx_hash') ||
          payload.txHash ||
          (entity as any).txHash ||
          undefined,
      };
    });

    // Filter by spaceIds client-side if multiple requested
    if (params?.spaceIds && params.spaceIds.length > 0) {
      asks = asks.filter((ask: Ask) => params.spaceIds!.includes(ask.spaceId));
    }

    if (params?.skill) {
      const skillLower = params.skill.toLowerCase();
      asks = asks.filter((ask: Ask) => ask.skill.toLowerCase().includes(skillLower));
    }

    // Record performance metrics
    const durationMs =
      typeof performance !== 'undefined' ? performance.now() - startTime : Date.now() - startTime;
    const payloadBytes = JSON.stringify(asks).length;

    // Record performance sample (async, don't block)
    import('@/lib/metrics/perf')
      .then(({ recordPerfSample }) => {
        recordPerfSample({
          source: 'arkiv',
          operation: 'listAsks',
          durationMs: Math.round(durationMs),
          payloadBytes,
          httpRequests: 2, // Two parallel queries: asks + txhashes
          createdAt: new Date().toISOString(),
        });
      })
      .catch(() => {
        // Silently fail if metrics module not available
      });

    return asks;
  } catch (error: any) {
    // CRITICAL: Catch ANY error and return empty array
    // This ensures the function NEVER throws, making it safe for GraphQL resolvers
    console.error('[listAsks] Unexpected error, returning empty array:', {
      message: error?.message,
      stack: error?.stack,
      error: error?.toString(),
    });
    return [];
  }
}

/**
 * List asks for a specific wallet
 *
 * @param wallet - Wallet address
 * @returns Array of asks for that wallet
 */
export async function listAsksForWallet(wallet: string, spaceId?: string): Promise<Ask[]> {
  const publicClient = getPublicClient();
  const query = arkivSelect(undefined, publicClient);
  let queryBuilder = query
    .where(eqAttr('type', 'ask'))
    .where(eqAttr('wallet', wallet.toLowerCase()));

  // Use provided spaceId or default to SPACE_ID from config
  const finalSpaceId = spaceId || SPACE_ID;
  queryBuilder = queryBuilder.where(eqAttr('space_id', finalSpaceId));

  const [result, txHashResult] = await Promise.all([
    queryBuilder.limit(100).fetch(),
    arkivSelect(undefined, publicClient)
      .where(eqAttr('type', 'ask_txhash'))
      .where(eqAttr('wallet', wallet.toLowerCase()))
      .limit(100)
      .fetch(),
  ]);

  // Defensive check: ensure result and entities exist
  if (!result || !result.entities || !Array.isArray(result.entities)) {
    console.warn('[listAsksForWallet] Invalid result structure, returning empty array', { result });
    return [];
  }

  const txHashMap: Record<string, string> = {};
  const txHashEntities = txHashResult?.entities || [];
  txHashEntities.forEach((entity: any) => {
    const getAttr = (key: string): string => readAttr(entity, key);
    const askKey = getAttr('ask_key');
    if (askKey) {
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
        console.error('Error decoding txHash payload:', e);
      }
      if (payload.txHash) {
        txHashMap[askKey] = payload.txHash;
      }
    }
  });

  return (result.entities || []).map((entity: any) => {
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
      console.error('Error decoding payload:', e);
    }

    const getAttr = (key: string): string => readAttr(entity, key);

    // Get TTL from attributes (stored when created), fallback to default for backward compatibility
    const ttlSecondsAttr = getAttr('ttl_seconds');
    const ttlSeconds = ttlSecondsAttr ? parseInt(ttlSecondsAttr, 10) : ASK_TTL_SECONDS;

    return {
      key: entity.key,
      wallet: getAttr('wallet') || payload.wallet || '',
      skill: getAttr('skill') || payload.skill || '', // Legacy: kept for backward compatibility
      skill_id: getAttr('skill_id') || payload.skill_id || undefined, // New: preferred for beta
      skill_label: getAttr('skill_label') || payload.skill_label || undefined, // Derived from Skill entity
      spaceId: getAttr('space_id') || payload.spaceId || SPACE_ID, // Use SPACE_ID from config as fallback (entities should always have spaceId)
      createdAt: getAttr('created_at') || payload.createdAt || '',
      status: getAttr('status') || payload.status || 'open',
      message: payload.message || '',
      ttlSeconds: isNaN(ttlSeconds) ? ASK_TTL_SECONDS : ttlSeconds, // Ensure valid number
      txHash:
        txHashMap[entity.key] ||
        getAttr('tx_hash') ||
        payload.txHash ||
        (entity as any).txHash ||
        undefined,
    };
  });
}

/**
 * Get an ask by key (entity key)
 */
export async function getAskByKey(key: string): Promise<Ask | null> {
  try {
    const publicClient = getPublicClient();
    const entity = await getEntityByKey(key, publicClient);
    if (!entity || readAttr(entity, 'type') !== 'ask' || readAttr(entity, 'project') !== PROJECT) {
      return null;
    }

    // Fetch txHash
    const txHashResult = await arkivSelect(undefined, publicClient)
      .where(eqAttr('type', 'ask_txhash'))
      .where(eqAttr('ask_key', key))
      .limit(1)
      .fetch();

    let txHash: string | undefined;
    if (
      txHashResult?.entities &&
      Array.isArray(txHashResult.entities) &&
      txHashResult.entities.length > 0
    ) {
      try {
        const txHashEntity = txHashResult.entities[0];
        if (txHashEntity.payload) {
          const decoded =
            txHashEntity.payload instanceof Uint8Array
              ? new TextDecoder().decode(txHashEntity.payload)
              : typeof txHashEntity.payload === 'string'
                ? txHashEntity.payload
                : JSON.stringify(txHashEntity.payload);
          const payload = JSON.parse(decoded);
          txHash = payload.txHash;
        }
      } catch (e) {
        // Ignore decode errors
      }
    }

    const getAttr = (key: string): string => readAttr(entity, key);

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
      console.error('[getAskByKey] Error decoding payload:', e);
    }

    const ttlSeconds = parseInt(getAttr('ttl_seconds')) || ASK_TTL_SECONDS;

    return {
      key: entity.key,
      wallet: getAttr('wallet') || payload.wallet || '',
      skill: getAttr('skill') || payload.skill || '',
      skill_id: getAttr('skill_id') || payload.skill_id || undefined,
      skill_label: getAttr('skill_label') || payload.skill_label || undefined,
      spaceId: getAttr('space_id') || payload.spaceId || SPACE_ID,
      createdAt: getAttr('created_at') || payload.createdAt || '',
      status: getAttr('status') || payload.status || 'open',
      message: payload.message || '',
      ttlSeconds: isNaN(ttlSeconds) ? ASK_TTL_SECONDS : ttlSeconds,
      txHash: txHash || getAttr('tx_hash') || payload.txHash || undefined,
    };
  } catch (error: any) {
    console.error('[getAskByKey] Error:', error);
    return null;
  }
}

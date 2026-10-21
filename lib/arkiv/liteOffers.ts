/**
 * Lite Offers CRUD helpers
 *
 * Simplified "I am teaching" offers for /lite page.
 * Uses fixed spaceId 'lite' and 1 month TTL.
 * No user profiles - just name and Discord handle.
 *
 * Reference: refs/lite-implementation-plan.md
 */

import { eqAttr } from '@/lib/arkiv/schema';
import { arkivSelect, fetchAll, getAttr as readAttr } from '@/lib/arkiv/read';
import { getPublicClient, getWalletClientFromPrivateKey } from './client';
import { handleTransactionWithTimeout } from './transaction-utils';
import { addSignerMetadata } from './signer-metadata';
import { createArkivEntity } from './write';

export const LITE_OFFER_TTL_SECONDS = 2592000; // 1 month (30 days)

export type LiteOffer = {
  key: string;
  name: string; // max 100 chars
  discordHandle: string; // max 50 chars, normalized lowercase
  skill: string; // max 200 chars (skill/topic)
  description?: string; // max 1000 chars
  cost?: string; // max 50 chars
  spaceId: string; // Always 'lite'
  createdAt: string;
  status: string;
  ttlSeconds: number;
  txHash?: string;
};

/**
 * Create a lite offer (I am teaching)
 *
 * @param data - Lite offer data
 * @param privateKey - Private key for signing (server wallet)
 * @returns Entity key and transaction hash
 */
export async function createLiteOffer({
  name,
  discordHandle,
  skill,
  description,
  cost,
  spaceId = 'nsapril26',
  privateKey,
}: {
  name: string;
  discordHandle: string;
  skill: string;
  description?: string;
  cost?: string;
  spaceId?: string;
  privateKey: `0x${string}`;
}): Promise<{ key: string; txHash: string }> {
  // Input validation
  if (!name || !name.trim()) {
    throw new Error('Name is required');
  }
  if (!discordHandle || !discordHandle.trim()) {
    throw new Error('Discord handle is required');
  }
  if (!skill || !skill.trim()) {
    throw new Error('Skill/topic is required');
  }

  // Validate max lengths
  if (name.length > 100) {
    throw new Error('Name must be 100 characters or less');
  }
  if (discordHandle.length > 50) {
    throw new Error('Discord handle must be 50 characters or less');
  }
  if (skill.length > 200) {
    throw new Error('Skill/topic must be 200 characters or less');
  }
  if (description && description.length > 1000) {
    throw new Error('Description must be 1000 characters or less');
  }
  if (cost && cost.length > 50) {
    throw new Error('Cost must be 50 characters or less');
  }

  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const finalSpaceId = spaceId || 'nsapril26'; // Use provided spaceId or default to 'nsapril26'
  const status = 'active';
  const createdAt = new Date().toISOString();
  const ttl = LITE_OFFER_TTL_SECONDS;

  // Normalize Discord handle to lowercase
  const normalizedDiscordHandle = discordHandle.toLowerCase().trim();

  // Attributes: short, queryable fields only.
  // name and skill/topic are free text (up to 100/200 chars) and live in the payload.
  // Add signer metadata (U1.x.2: Central Signer Metadata)
  const attributes = addSignerMetadata(
    {
      discord_handle: normalizedDiscordHandle,
      space_id: spaceId,
      created_at: createdAt,
      status,
      ttl_seconds: String(ttl),
      cost: cost?.trim() || undefined,
    },
    privateKey
  );

  const result = await handleTransactionWithTimeout(async () => {
    return await createArkivEntity(walletClient, {
      type: 'lite_offer',
      attributes,
      payload: {
        name: name.trim(),
        skill: skill.trim(),
        description: description?.trim() || undefined,
        cost: cost?.trim() || undefined,
      },
      lifetimeSeconds: ttl,
    });
  });

  const { entityKey, txHash } = result;

  // Structured logging (U1.x.1: Explorer Independence)
  const { logEntityWrite } = await import('./write-logging');
  logEntityWrite({
    entityType: 'lite_offer',
    entityKey,
    txHash,
    wallet: '', // No wallet for lite version
    timestamp: createdAt,
    operation: 'create',
    spaceId,
  });

  // Create separate txhash entity (like mentor-graph)
  // Don't wait for this one - it's optional metadata
  createArkivEntity(walletClient, {
    type: 'lite_offer_txhash',
    attributes: {
      offer_key: entityKey,
      discord_handle: normalizedDiscordHandle,
      space_id: spaceId,
    },
    payload: { txHash },
    lifetimeSeconds: ttl,
  }).catch((error: unknown) => {
    console.warn('[createLiteOffer] Failed to create lite_offer_txhash entity:', error);
  });

  // Note: tx_event creation skipped for lite entities
  // tx_event only supports 'profile' | 'ask' | 'offer' | 'skill' types
  // Lite entities are tracked via lite_offer_txhash entities instead

  return { key: entityKey, txHash };
}

/**
 * List all active lite offers
 *
 * @param params - Optional filters
 * @returns Array of lite offers
 */
export async function listLiteOffers(params?: {
  skill?: string;
  spaceId?: string;
  limit?: number;
  includeExpired?: boolean;
}): Promise<LiteOffer[]> {
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

  try {
    const publicClient = getPublicClient();
    const limit = params?.limit ?? 500;
    const spaceId = params?.spaceId || 'nsapril26'; // Default to 'nsapril26' if not provided
    const queryBuilder = arkivSelect('lite_offer', publicClient)
      .where(eqAttr('status', 'active'))
      .where(eqAttr('space_id', spaceId)); // Filter by provided spaceId

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let txHashResult: any = null;

    try {
      [result, txHashResult] = await Promise.all([
        fetchAll(queryBuilder, limit, publicClient),
        fetchAll(
          arkivSelect('lite_offer_txhash', publicClient).where(eqAttr('space_id', spaceId)),
          limit,
          publicClient
        ),
      ]);
    } catch (fetchError: unknown) {
      console.error('[listLiteOffers] Arkiv query failed:', fetchError);
      return []; // Return empty array on query failure
    }

    // Defensive check: ensure result and entities exist
    if (!result || !result.entities || !Array.isArray(result.entities)) {
      console.warn('[listLiteOffers] Invalid result structure, returning empty array', {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    txHashEntities.forEach((entity: any) => {
      const getAttr = (key: string): string => readAttr(entity, key);
      const offerKey = getAttr('offer_key');
      if (offerKey) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        } catch {
          // Silently ignore payload decoding errors
        }
        if (payload.txHash) {
          txHashMap[offerKey] = payload.txHash;
        }
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let offers: LiteOffer[] = (result.entities || []).map((entity: any): LiteOffer => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      } catch {
        // Silently ignore payload decoding errors
      }

      const getAttr = (key: string): string => readAttr(entity, key);

      const ttlSecondsAttr = getAttr('ttl_seconds');
      const ttlSeconds = ttlSecondsAttr ? parseInt(ttlSecondsAttr, 10) : LITE_OFFER_TTL_SECONDS;

      return {
        key: entity.key,
        name: payload.name || getAttr('name') || '',
        discordHandle: getAttr('discord_handle') || '',
        skill: payload.skill || getAttr('skill') || '',
        description: payload.description || undefined,
        cost: payload.cost || getAttr('cost') || undefined,
        spaceId: getAttr('space_id') || 'nsapril26',
        createdAt: getAttr('created_at') || payload.createdAt || '',
        status: getAttr('status') || payload.status || 'active',
        ttlSeconds: isNaN(ttlSeconds) ? LITE_OFFER_TTL_SECONDS : ttlSeconds,
        txHash:
          txHashMap[entity.key] ||
          getAttr('tx_hash') ||
          payload.txHash ||
          entity.txHash ||
          undefined,
      };
    });

    // Filter by skill if provided
    if (params?.skill) {
      const skillLower = params.skill.toLowerCase();
      offers = offers.filter((offer: LiteOffer) => offer.skill.toLowerCase().includes(skillLower));
    }

    // Filter expired offers if includeExpired is false (default)
    if (!params?.includeExpired) {
      const now = Date.now();
      offers = offers.filter((offer: LiteOffer) => {
        const created = new Date(offer.createdAt).getTime();
        const expires = created + offer.ttlSeconds * 1000;
        return now < expires;
      });
    }

    // Record performance metrics
    const durationMs =
      typeof performance !== 'undefined' ? performance.now() - startTime : Date.now() - startTime;
    const payloadBytes = JSON.stringify(offers).length;

    // Record performance sample (async, don't block)
    import('@/lib/metrics/perf')
      .then(({ recordPerfSample }) => {
        recordPerfSample({
          source: 'arkiv',
          operation: 'listLiteOffers',
          durationMs: Math.round(durationMs),
          payloadBytes,
          httpRequests: 2, // Two parallel queries: offers + txhashes
          createdAt: new Date().toISOString(),
        });
      })
      .catch(() => {
        // Silently fail if metrics module not available
      });

    return offers;
  } catch (error: unknown) {
    // CRITICAL: Catch ANY error and return empty array
    // This ensures the function NEVER throws, making it safe for GraphQL resolvers
    console.error('[listLiteOffers] Unexpected error, returning empty array:', error);
    return [];
  }
}

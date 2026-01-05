/**
 * Lite Offers CRUD helpers
 * 
 * Simplified "I am teaching" offers for /lite page.
 * Uses fixed spaceId 'lite' and 1 month TTL.
 * No user profiles - just name and Discord handle.
 * 
 * Reference: refs/lite-implementation-plan.md
 */

import { eq } from "@arkiv-network/sdk/query"
import { getPublicClient, getWalletClientFromPrivateKey } from "./client"
import { handleTransactionWithTimeout } from "./transaction-utils"

export const LITE_OFFER_TTL_SECONDS = 2592000; // 1 month (30 days)

export type LiteOffer = {
  key: string;
  name: string;              // max 100 chars
  discordHandle: string;     // max 50 chars, normalized lowercase
  skill: string;             // max 200 chars (skill/topic)
  description?: string;      // max 1000 chars
  cost?: string;             // max 50 chars
  spaceId: string;           // Always 'lite'
  createdAt: string;
  status: string;
  ttlSeconds: number;
  txHash?: string;
}

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
  privateKey,
}: {
  name: string;
  discordHandle: string;
  skill: string;
  description?: string;
  cost?: string;
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
  const enc = new TextEncoder();
  const spaceId = 'lite'; // Fixed spaceId for lite version
  const status = 'active';
  const createdAt = new Date().toISOString();
  const ttl = LITE_OFFER_TTL_SECONDS;

  // Normalize Discord handle to lowercase
  const normalizedDiscordHandle = discordHandle.toLowerCase().trim();

  // Build attributes array
  const attributes: Array<{ key: string; value: string }> = [
    { key: 'type', value: 'lite_offer' },
    { key: 'name', value: name.trim() },
    { key: 'discordHandle', value: normalizedDiscordHandle },
    { key: 'skill', value: skill.trim() },
    { key: 'spaceId', value: spaceId },
    { key: 'createdAt', value: createdAt },
    { key: 'status', value: status },
    { key: 'ttlSeconds', value: String(ttl) },
  ];

  // Add cost if provided
  if (cost && cost.trim()) {
    attributes.push({ key: 'cost', value: cost.trim() });
  }

  // Add signer metadata (U1.x.2: Central Signer Metadata)
  const { addSignerMetadata } = await import('./signer-metadata');
  const attributesWithSigner = addSignerMetadata(attributes, privateKey);

  const result = await handleTransactionWithTimeout(async () => {
    return await walletClient.createEntity({
      payload: enc.encode(JSON.stringify({
        description: description?.trim() || undefined,
      })),
      contentType: 'application/json',
      attributes: attributesWithSigner,
      expiresIn: ttl,
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
  walletClient.createEntity({
    payload: enc.encode(JSON.stringify({
      txHash,
    })),
    contentType: 'application/json',
    attributes: [
      { key: 'type', value: 'lite_offer_txhash' },
      { key: 'offerKey', value: entityKey },
      { key: 'discordHandle', value: normalizedDiscordHandle },
      { key: 'spaceId', value: spaceId },
    ],
    expiresIn: ttl,
  }).catch((error: any) => {
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
export async function listLiteOffers(params?: { skill?: string; limit?: number; includeExpired?: boolean }): Promise<LiteOffer[]> {
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  
  try {
    const publicClient = getPublicClient();
    const query = publicClient.buildQuery();
    const limit = params?.limit ?? 500;
    let queryBuilder = query
      .where(eq('type', 'lite_offer'))
      .where(eq('status', 'active'))
      .where(eq('spaceId', 'lite')); // Always filter by 'lite' spaceId
    
    let result: any = null;
    let txHashResult: any = null;
    
    try {
      [result, txHashResult] = await Promise.all([
        queryBuilder.withAttributes(true).withPayload(true).limit(limit).fetch(),
        publicClient.buildQuery()
          .where(eq('type', 'lite_offer_txhash'))
          .where(eq('spaceId', 'lite'))
          .withAttributes(true)
          .withPayload(true)
          .limit(limit)
          .fetch(),
      ]);
    } catch (fetchError: any) {
      console.error('[listLiteOffers] Arkiv query failed:', {
        message: fetchError?.message,
        stack: fetchError?.stack,
        error: fetchError
      });
      return []; // Return empty array on query failure
    }

    // Defensive check: ensure result and entities exist
    if (!result || !result.entities || !Array.isArray(result.entities)) {
      console.warn('[listLiteOffers] Invalid result structure, returning empty array', { 
        result: result ? { hasEntities: !!result.entities, entitiesType: typeof result.entities, entitiesIsArray: Array.isArray(result.entities) } : 'null/undefined'
      });
      return [];
    }

    const txHashMap: Record<string, string> = {};
    const txHashEntities = txHashResult?.entities || [];
    txHashEntities.forEach((entity: any) => {
      const attrs = entity.attributes || {};
      const getAttr = (key: string): string => {
        if (Array.isArray(attrs)) {
          const attr = attrs.find((a: any) => a.key === key);
          return String(attr?.value || '');
        }
        return String(attrs[key] || '');
      };
      const offerKey = getAttr('offerKey');
      if (offerKey) {
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
          console.error('Error decoding txHash payload:', e);
        }
        if (payload.txHash) {
          txHashMap[offerKey] = payload.txHash;
        }
      }
    });

    let offers: LiteOffer[] = (result.entities || []).map((entity: any): LiteOffer => {
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
        console.error('Error decoding payload:', e);
      }

      const attrs = entity.attributes || {};
      const getAttr = (key: string): string => {
        if (Array.isArray(attrs)) {
          const attr = attrs.find((a: any) => a.key === key);
          return String(attr?.value || '');
        }
        return String(attrs[key] || '');
      };
      
      const ttlSecondsAttr = getAttr('ttlSeconds');
      const ttlSeconds = ttlSecondsAttr ? parseInt(ttlSecondsAttr, 10) : LITE_OFFER_TTL_SECONDS;
      
      return {
        key: entity.key,
        name: getAttr('name') || '',
        discordHandle: getAttr('discordHandle') || '',
        skill: getAttr('skill') || '',
        description: payload.description || undefined,
        cost: getAttr('cost') || payload.cost || undefined,
        spaceId: getAttr('spaceId') || 'lite',
        createdAt: getAttr('createdAt') || payload.createdAt || '',
        status: getAttr('status') || payload.status || 'active',
        ttlSeconds: isNaN(ttlSeconds) ? LITE_OFFER_TTL_SECONDS : ttlSeconds,
        txHash: txHashMap[entity.key] || getAttr('txHash') || payload.txHash || (entity as any).txHash || undefined,
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
        const expires = created + (offer.ttlSeconds * 1000);
        return now < expires;
      });
    }

    // Record performance metrics
    const durationMs = typeof performance !== 'undefined' ? performance.now() - startTime : Date.now() - startTime;
    const payloadBytes = JSON.stringify(offers).length;
    
    // Record performance sample (async, don't block)
    import('@/lib/metrics/perf').then(({ recordPerfSample }) => {
      recordPerfSample({
        source: 'arkiv',
        operation: 'listLiteOffers',
        durationMs: Math.round(durationMs),
        payloadBytes,
        httpRequests: 2, // Two parallel queries: offers + txhashes
        createdAt: new Date().toISOString(),
      });
    }).catch(() => {
      // Silently fail if metrics module not available
    });

    return offers;
  } catch (error: any) {
    // CRITICAL: Catch ANY error and return empty array
    // This ensures the function NEVER throws, making it safe for GraphQL resolvers
    console.error('[listLiteOffers] Unexpected error, returning empty array:', {
      message: error?.message,
      stack: error?.stack,
      error: error?.toString()
    });
    return [];
  }
}


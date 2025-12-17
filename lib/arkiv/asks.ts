/**
 * Asks CRUD helpers
 * 
 * "I am learning" - users post what they want to learn
 * 
 * Based on mentor-graph implementation.
 * 
 * Reference: refs/mentor-graph/src/arkiv/asks.ts
 */

import { eq } from "@arkiv-network/sdk/query"
import { getPublicClient, getWalletClientFromPrivateKey } from "./client"
import { handleTransactionWithTimeout } from "./transaction-utils"
import { SPACE_ID } from "@/lib/config"

export const ASK_TTL_SECONDS = 3600; // 1 hour default

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
}

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
  const enc = new TextEncoder();
  const spaceId = SPACE_ID;
  const status = 'open';
  const createdAt = new Date().toISOString();
  // Use expiresIn if provided and valid, otherwise use default
  // Ensure ttl is always an integer (BigInt requirement)
  const ttlRaw = (expiresIn !== undefined && expiresIn !== null && typeof expiresIn === 'number' && expiresIn > 0) ? expiresIn : ASK_TTL_SECONDS;
  const ttl = Math.floor(ttlRaw);

  // Build attributes array
  const attributes: Array<{ key: string; value: string }> = [
    { key: 'type', value: 'ask' },
    { key: 'wallet', value: wallet.toLowerCase() },
    { key: 'spaceId', value: spaceId },
    { key: 'createdAt', value: createdAt },
    { key: 'status', value: status },
    { key: 'ttlSeconds', value: String(ttl) },
  ];

  // Add skill fields (legacy for compatibility, new for beta)
  if (skill) {
    attributes.push({ key: 'skill', value: skill });
  }
  if (skill_id) {
    attributes.push({ key: 'skill_id', value: skill_id });
  }
  if (skill_label) {
    attributes.push({ key: 'skill_label', value: skill_label });
  }

  const result = await handleTransactionWithTimeout(async () => {
    return await walletClient.createEntity({
      payload: enc.encode(JSON.stringify({
        message,
      })),
      contentType: 'application/json',
      attributes,
      expiresIn: ttl,
    });
  });

  const { entityKey, txHash } = result;

  // Create separate txhash entity (like mentor-graph)
  // Don't wait for this one - it's optional metadata
  walletClient.createEntity({
    payload: enc.encode(JSON.stringify({
      txHash,
    })),
    contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'ask_txhash' },
        { key: 'askKey', value: entityKey },
        { key: 'wallet', value: wallet.toLowerCase() },
        { key: 'spaceId', value: spaceId },
    ],
    expiresIn: ttl,
  });

  return { key: entityKey, txHash };
}

/**
 * List all open asks
 * 
 * @param params - Optional filters (skill, spaceId, spaceIds)
 * @returns Array of asks
 */
export async function listAsks(params?: { skill?: string; spaceId?: string; spaceIds?: string[]; limit?: number; includeExpired?: boolean }): Promise<Ask[]> {
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  
  try {
    const publicClient = getPublicClient();
    const query = publicClient.buildQuery();
    const limit = params?.limit ?? 500; // raise limit so expired/historical entries can be fetched
    let queryBuilder = query.where(eq('type', 'ask')).where(eq('status', 'open'));
    
    // Support multiple spaceIds (builder mode) or single spaceId
    if (params?.spaceIds && params.spaceIds.length > 0) {
      // Query all, filter client-side (Arkiv doesn't support OR queries)
      queryBuilder = queryBuilder.limit(limit);
    } else {
      // Use provided spaceId or default to SPACE_ID from config
      const spaceId = params?.spaceId || SPACE_ID;
      queryBuilder = queryBuilder.where(eq('spaceId', spaceId));
    }
    
    let result: any = null;
    let txHashResult: any = null;
    
    try {
      [result, txHashResult] = await Promise.all([
        queryBuilder.withAttributes(true).withPayload(true).limit(limit).fetch(),
        publicClient.buildQuery()
          .where(eq('type', 'ask_txhash'))
        .withAttributes(true)
        .withPayload(true)
        .limit(limit)
          .fetch(),
      ]);
    } catch (fetchError: any) {
      console.error('[listAsks] Arkiv query failed:', {
        message: fetchError?.message,
        stack: fetchError?.stack,
        error: fetchError
      });
      return []; // Return empty array on query failure
    }

    // Defensive check: ensure result and entities exist
    if (!result || !result.entities || !Array.isArray(result.entities)) {
      console.warn('[listAsks] Invalid result structure, returning empty array', { 
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
    const askKey = getAttr('askKey');
    if (askKey) {
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
        txHashMap[askKey] = payload.txHash;
      }
    }
  });

  let asks = (result.entities || []).map((entity: any) => {
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
    
    // Get TTL from attributes (stored when created), fallback to default for backward compatibility
    const ttlSecondsAttr = getAttr('ttlSeconds');
    const ttlSeconds = ttlSecondsAttr ? parseInt(ttlSecondsAttr, 10) : ASK_TTL_SECONDS;
    
    return {
      key: entity.key,
      wallet: getAttr('wallet') || payload.wallet || '',
      skill: getAttr('skill') || payload.skill || '', // Legacy: kept for backward compatibility
      skill_id: getAttr('skill_id') || payload.skill_id || undefined, // New: preferred for beta
      skill_label: getAttr('skill_label') || payload.skill_label || undefined, // Derived from Skill entity
      spaceId: getAttr('spaceId') || payload.spaceId || SPACE_ID, // Use SPACE_ID from config as fallback (entities should always have spaceId)
      createdAt: getAttr('createdAt') || payload.createdAt || '',
      status: getAttr('status') || payload.status || 'open',
      message: payload.message || '',
      ttlSeconds: isNaN(ttlSeconds) ? ASK_TTL_SECONDS : ttlSeconds, // Ensure valid number
      txHash: txHashMap[entity.key] || getAttr('txHash') || payload.txHash || (entity as any).txHash || undefined,
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
    const durationMs = typeof performance !== 'undefined' ? performance.now() - startTime : Date.now() - startTime;
    const payloadBytes = JSON.stringify(asks).length;
    
    // Record performance sample (async, don't block)
    import('@/lib/metrics/perf').then(({ recordPerfSample }) => {
      recordPerfSample({
        source: 'arkiv',
        operation: 'listAsks',
        durationMs: Math.round(durationMs),
        payloadBytes,
        httpRequests: 2, // Two parallel queries: asks + txhashes
        createdAt: new Date().toISOString(),
      });
    }).catch(() => {
      // Silently fail if metrics module not available
    });

    return asks;
  } catch (error: any) {
    // CRITICAL: Catch ANY error and return empty array
    // This ensures the function NEVER throws, making it safe for GraphQL resolvers
    console.error('[listAsks] Unexpected error, returning empty array:', {
      message: error?.message,
      stack: error?.stack,
      error: error?.toString()
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
  const query = publicClient.buildQuery();
  let queryBuilder = query
    .where(eq('type', 'ask'))
    .where(eq('wallet', wallet.toLowerCase()));
  
  // Use provided spaceId or default to SPACE_ID from config
  const finalSpaceId = spaceId || SPACE_ID;
  queryBuilder = queryBuilder.where(eq('spaceId', finalSpaceId));
  
  const [result, txHashResult] = await Promise.all([
    queryBuilder
      .withAttributes(true)
      .withPayload(true)
      .limit(100)
      .fetch(),
        publicClient.buildQuery()
          .where(eq('type', 'ask_txhash'))
          .where(eq('wallet', wallet.toLowerCase()))
      .withAttributes(true)
      .withPayload(true)
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
    const attrs = entity.attributes || {};
    const getAttr = (key: string): string => {
      if (Array.isArray(attrs)) {
        const attr = attrs.find((a: any) => a.key === key);
        return String(attr?.value || '');
      }
      return String(attrs[key] || '');
    };
    const askKey = getAttr('askKey');
    if (askKey) {
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
        txHashMap[askKey] = payload.txHash;
      }
    }
  });

  return (result.entities || []).map((entity: any) => {
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
    
    // Get TTL from attributes (stored when created), fallback to default for backward compatibility
    const ttlSecondsAttr = getAttr('ttlSeconds');
    const ttlSeconds = ttlSecondsAttr ? parseInt(ttlSecondsAttr, 10) : ASK_TTL_SECONDS;
    
    return {
      key: entity.key,
      wallet: getAttr('wallet') || payload.wallet || '',
      skill: getAttr('skill') || payload.skill || '', // Legacy: kept for backward compatibility
      skill_id: getAttr('skill_id') || payload.skill_id || undefined, // New: preferred for beta
      skill_label: getAttr('skill_label') || payload.skill_label || undefined, // Derived from Skill entity
      spaceId: getAttr('spaceId') || payload.spaceId || SPACE_ID, // Use SPACE_ID from config as fallback (entities should always have spaceId)
      createdAt: getAttr('createdAt') || payload.createdAt || '',
      status: getAttr('status') || payload.status || 'open',
      message: payload.message || '',
      ttlSeconds: isNaN(ttlSeconds) ? ASK_TTL_SECONDS : ttlSeconds, // Ensure valid number
      txHash: txHashMap[entity.key] || getAttr('txHash') || payload.txHash || (entity as any).txHash || undefined,
    };
  });
}


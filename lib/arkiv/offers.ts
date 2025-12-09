/**
 * Offers CRUD helpers
 * 
 * "I am teaching" - users post what they can teach
 * 
 * Based on mentor-graph implementation.
 * 
 * Reference: refs/mentor-graph/src/arkiv/offers.ts
 */

import { eq } from "@arkiv-network/sdk/query"
import { getPublicClient, getWalletClientFromPrivateKey } from "./client"
import { handleTransactionWithTimeout } from "./transaction-utils"
import { getAvailabilityByKey, type WeeklyAvailability, serializeWeeklyAvailability, validateWeeklyAvailability } from "./availability"

export const OFFER_TTL_SECONDS = 7200; // 2 hours default

export type Offer = {
  key: string;
  wallet: string;
  skill: string;
  spaceId: string;
  createdAt: string;
  status: string;
  message: string;
  availabilityWindow: string;
  availabilityKey?: string; // Optional reference to Availability entity
  isPaid: boolean; // free/paid flag
  cost?: string; // Cost amount (required if isPaid is true)
  paymentAddress?: string; // Payment receiving address (if paid)
  ttlSeconds: number;
  txHash?: string;
}

/**
 * Create an offer (I am teaching)
 * 
 * @param data - Offer data
 * @param privateKey - Private key for signing
 * @returns Entity key and transaction hash
 */
export async function createOffer({
  wallet,
  skill,
  message,
  availabilityWindow,
  availabilityKey,
  isPaid,
  cost,
  paymentAddress,
  privateKey,
  expiresIn,
}: {
  wallet: string;
  skill: string;
  message: string;
  availabilityWindow: string | WeeklyAvailability; // Support both text and structured format
  availabilityKey?: string; // Optional reference to Availability entity
  isPaid: boolean;
  cost?: string; // Required if isPaid is true
  paymentAddress?: string;
  privateKey: `0x${string}`;
  expiresIn?: number;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();
  const spaceId = 'local-dev';
  const status = 'active';
  const createdAt = new Date().toISOString();
  // Use expiresIn if provided and valid, otherwise use default
  const ttl = (expiresIn !== undefined && expiresIn !== null && typeof expiresIn === 'number' && expiresIn > 0) ? expiresIn : OFFER_TTL_SECONDS;

  // Handle availabilityWindow: serialize WeeklyAvailability to JSON, or use string as-is
  let availabilityWindowString: string;
  if (typeof availabilityWindow === 'object' && availabilityWindow.version === '1.0') {
    // Structured format: validate and serialize
    const validation = validateWeeklyAvailability(availabilityWindow);
    if (!validation.valid) {
      throw new Error(`Invalid weekly availability: ${validation.error}`);
    }
    availabilityWindowString = serializeWeeklyAvailability(availabilityWindow);
  } else {
    // Legacy text format
    availabilityWindowString = typeof availabilityWindow === 'string' ? availabilityWindow : String(availabilityWindow);
  }

  const result = await handleTransactionWithTimeout(async () => {
    return await walletClient.createEntity({
      payload: enc.encode(JSON.stringify({
        message,
        availabilityWindow: availabilityWindowString,
        isPaid,
        cost: cost || undefined,
        paymentAddress: paymentAddress || undefined,
      })),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'offer' },
        { key: 'wallet', value: wallet },
        { key: 'skill', value: skill },
        { key: 'spaceId', value: spaceId },
        { key: 'createdAt', value: createdAt },
        { key: 'status', value: status },
        { key: 'isPaid', value: String(isPaid) },
        { key: 'ttlSeconds', value: String(ttl) }, // Store TTL for retrieval
        ...(cost ? [{ key: 'cost', value: cost }] : []),
        ...(paymentAddress ? [{ key: 'paymentAddress', value: paymentAddress }] : []),
        ...(availabilityKey ? [{ key: 'availabilityKey', value: availabilityKey }] : []),
      ],
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
      { key: 'type', value: 'offer_txhash' },
      { key: 'offerKey', value: entityKey },
      { key: 'wallet', value: wallet },
      { key: 'spaceId', value: spaceId },
    ],
    expiresIn: ttl,
  });

  return { key: entityKey, txHash };
}

/**
 * List all active offers
 * 
 * @param params - Optional filters (skill, spaceId)
 * @returns Array of offers
 */
export async function listOffers(params?: { skill?: string; spaceId?: string; limit?: number; includeExpired?: boolean }): Promise<Offer[]> {
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  
  try {
    const publicClient = getPublicClient();
    const query = publicClient.buildQuery();
    const limit = params?.limit ?? 500; // raise limit so expired/historical entries can be fetched
    let queryBuilder = query.where(eq('type', 'offer')).where(eq('status', 'active'));
    
    if (params?.spaceId) {
      queryBuilder = queryBuilder.where(eq('spaceId', params.spaceId));
    }
    
    let result: any = null;
    let txHashResult: any = null;
    
    try {
      [result, txHashResult] = await Promise.all([
        queryBuilder.withAttributes(true).withPayload(true).limit(limit).fetch(),
        publicClient.buildQuery()
          .where(eq('type', 'offer_txhash'))
        .withAttributes(true)
        .withPayload(true)
        .limit(limit)
          .fetch(),
      ]);
    } catch (fetchError: any) {
      console.error('[listOffers] Arkiv query failed:', {
        message: fetchError?.message,
        stack: fetchError?.stack,
        error: fetchError
      });
      return []; // Return empty array on query failure
    }

    // Defensive check: ensure result and entities exist
    if (!result || !result.entities || !Array.isArray(result.entities)) {
      console.warn('[listOffers] Invalid result structure, returning empty array', { 
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

  let offers: Offer[] = (result.entities || []).map((entity: any): Offer => {
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
    const ttlSeconds = ttlSecondsAttr ? parseInt(ttlSecondsAttr, 10) : OFFER_TTL_SECONDS;
    
    return {
      key: entity.key,
      wallet: getAttr('wallet') || payload.wallet || '',
      skill: getAttr('skill') || payload.skill || '',
      spaceId: getAttr('spaceId') || payload.spaceId || 'local-dev',
      createdAt: getAttr('createdAt') || payload.createdAt || '',
      status: getAttr('status') || payload.status || 'active',
      message: payload.message || '',
      availabilityWindow: payload.availabilityWindow || '',
      availabilityKey: getAttr('availabilityKey') || undefined,
      isPaid: payload.isPaid === true || getAttr('isPaid') === 'true',
      cost: payload.cost || getAttr('cost') || undefined,
      paymentAddress: payload.paymentAddress || getAttr('paymentAddress') || undefined,
      ttlSeconds: isNaN(ttlSeconds) ? OFFER_TTL_SECONDS : ttlSeconds, // Ensure valid number
      txHash: txHashMap[entity.key] || getAttr('txHash') || payload.txHash || (entity as any).txHash || undefined,
    };
  });

    if (params?.skill) {
      const skillLower = params.skill.toLowerCase();
      offers = offers.filter((offer: Offer) => offer.skill.toLowerCase().includes(skillLower));
    }

    // Fetch availability data for offers that reference availability entities
    const offersWithAvailabilityKey = offers.filter((offer: Offer) => offer.availabilityKey);
    if (offersWithAvailabilityKey.length > 0) {
      const availabilityPromises = offersWithAvailabilityKey.map(async (offer: Offer) => {
        if (!offer.availabilityKey) return null;
        try {
          const availability = await getAvailabilityByKey(offer.availabilityKey);
          return { offerKey: offer.key, availability };
        } catch (error) {
          console.error(`Error fetching availability for offer ${offer.key}:`, error);
          return null;
        }
      });

      const availabilityResults = await Promise.all(availabilityPromises);
      const availabilityMap = new Map<string, string>();
      availabilityResults.forEach((result) => {
        if (result && result.availability) {
          // Use timeBlocks from availability entity as availabilityWindow
          availabilityMap.set(result.offerKey, result.availability.timeBlocks);
        }
      });

      // Update offers with availability data from referenced entities
      offers = offers.map((offer: Offer) => {
        if (offer.availabilityKey && availabilityMap.has(offer.key)) {
          const updated: Offer = {
            ...offer,
            availabilityWindow: availabilityMap.get(offer.key) || offer.availabilityWindow,
          };
          return updated;
        }
        return offer;
      });
    }

    // Record performance metrics
    const durationMs = typeof performance !== 'undefined' ? performance.now() - startTime : Date.now() - startTime;
    const payloadBytes = JSON.stringify(offers).length;
    
    // Record performance sample (async, don't block)
    import('@/lib/metrics/perf').then(({ recordPerfSample }) => {
      recordPerfSample({
        source: 'arkiv',
        operation: 'listOffers',
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
    console.error('[listOffers] Unexpected error, returning empty array:', {
      message: error?.message,
      stack: error?.stack,
      error: error?.toString()
    });
    return [];
  }
}

/**
 * List offers for a specific wallet
 * 
 * @param wallet - Wallet address
 * @returns Array of offers for that wallet
 */
export async function listOffersForWallet(wallet: string): Promise<Offer[]> {
  const publicClient = getPublicClient();
  const query = publicClient.buildQuery();
  const [result, txHashResult] = await Promise.all([
    query
      .where(eq('type', 'offer'))
      .where(eq('wallet', wallet))
      .withAttributes(true)
      .withPayload(true)
      .limit(100)
      .fetch(),
    publicClient.buildQuery()
      .where(eq('type', 'offer_txhash'))
      .where(eq('wallet', wallet))
      .withAttributes(true)
      .withPayload(true)
      .limit(100)
      .fetch(),
  ]);

  // Defensive check: ensure result and entities exist
  if (!result || !result.entities || !Array.isArray(result.entities)) {
    console.warn('[listOffersForWallet] Invalid result structure, returning empty array', { result });
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

  let offers: Offer[] = (result.entities || []).map((entity: any): Offer => {
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
    const ttlSeconds = ttlSecondsAttr ? parseInt(ttlSecondsAttr, 10) : OFFER_TTL_SECONDS;
    
    return {
      key: entity.key,
      wallet: getAttr('wallet') || payload.wallet || '',
      skill: getAttr('skill') || payload.skill || '',
      spaceId: getAttr('spaceId') || payload.spaceId || 'local-dev',
      createdAt: getAttr('createdAt') || payload.createdAt || '',
      status: getAttr('status') || payload.status || 'active',
      message: payload.message || '',
      availabilityWindow: payload.availabilityWindow || '',
      availabilityKey: getAttr('availabilityKey') || undefined,
      isPaid: payload.isPaid === true || getAttr('isPaid') === 'true',
      cost: payload.cost || getAttr('cost') || undefined,
      paymentAddress: payload.paymentAddress || getAttr('paymentAddress') || undefined,
      ttlSeconds: isNaN(ttlSeconds) ? OFFER_TTL_SECONDS : ttlSeconds, // Ensure valid number
      txHash: txHashMap[entity.key] || getAttr('txHash') || payload.txHash || (entity as any).txHash || undefined,
    };
  });

  // Fetch availability data for offers that reference availability entities
  const offersWithAvailabilityKey = offers.filter((offer: Offer) => offer.availabilityKey);
  if (offersWithAvailabilityKey.length > 0) {
    const availabilityPromises = offersWithAvailabilityKey.map(async (offer: Offer) => {
      if (!offer.availabilityKey) return null;
      try {
        const availability = await getAvailabilityByKey(offer.availabilityKey);
        return { offerKey: offer.key, availability };
      } catch (error) {
        console.error(`Error fetching availability for offer ${offer.key}:`, error);
        return null;
      }
    });

    const availabilityResults = await Promise.all(availabilityPromises);
    const availabilityMap = new Map<string, string>();
    availabilityResults.forEach((result) => {
      if (result && result.availability) {
        // Use timeBlocks from availability entity as availabilityWindow
        availabilityMap.set(result.offerKey, result.availability.timeBlocks);
      }
    });

    // Update offers with availability data from referenced entities
    offers = offers.map((offer: Offer) => {
      if (offer.availabilityKey && availabilityMap.has(offer.key)) {
        const updated: Offer = {
          ...offer,
          availabilityWindow: availabilityMap.get(offer.key) || offer.availabilityWindow,
        };
        return updated;
      }
      return offer;
    });
  }

  return offers;
}


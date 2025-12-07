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

export const ASK_TTL_SECONDS = 3600; // 1 hour default

export type Ask = {
  key: string;
  wallet: string;
  skill: string;
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
  skill,
  message,
  privateKey,
  expiresIn,
}: {
  wallet: string;
  skill: string;
  message: string;
  privateKey: `0x${string}`;
  expiresIn?: number;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();
  const spaceId = 'local-dev';
  const status = 'open';
  const createdAt = new Date().toISOString();
  // Use expiresIn if provided and valid, otherwise use default
  const ttl = (expiresIn !== undefined && expiresIn !== null && typeof expiresIn === 'number' && expiresIn > 0) ? expiresIn : ASK_TTL_SECONDS;

  const result = await handleTransactionWithTimeout(async () => {
    return await walletClient.createEntity({
      payload: enc.encode(JSON.stringify({
        message,
      })),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'ask' },
        { key: 'wallet', value: wallet },
        { key: 'skill', value: skill },
        { key: 'spaceId', value: spaceId },
        { key: 'createdAt', value: createdAt },
        { key: 'status', value: status },
        { key: 'ttlSeconds', value: String(ttl) }, // Store TTL for retrieval
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
      { key: 'type', value: 'ask_txhash' },
      { key: 'askKey', value: entityKey },
      { key: 'wallet', value: wallet },
      { key: 'spaceId', value: spaceId },
    ],
    expiresIn: ttl,
  });

  return { key: entityKey, txHash };
}

/**
 * List all open asks
 * 
 * @param params - Optional filters (skill, spaceId)
 * @returns Array of asks
 */
export async function listAsks(params?: { skill?: string; spaceId?: string }): Promise<Ask[]> {
  const publicClient = getPublicClient();
  const query = publicClient.buildQuery();
  let queryBuilder = query.where(eq('type', 'ask')).where(eq('status', 'open'));
  
  if (params?.spaceId) {
    queryBuilder = queryBuilder.where(eq('spaceId', params.spaceId));
  }
  
  const [result, txHashResult] = await Promise.all([
    queryBuilder.withAttributes(true).withPayload(true).limit(100).fetch(),
    publicClient.buildQuery()
      .where(eq('type', 'ask_txhash'))
      .withAttributes(true)
      .withPayload(true)
      .limit(100)
      .fetch(),
  ]);

  const txHashMap: Record<string, string> = {};
  txHashResult.entities.forEach((entity: any) => {
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

  let asks = result.entities.map((entity: any) => {
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
      skill: getAttr('skill') || payload.skill || '',
      spaceId: getAttr('spaceId') || payload.spaceId || 'local-dev',
      createdAt: getAttr('createdAt') || payload.createdAt || '',
      status: getAttr('status') || payload.status || 'open',
      message: payload.message || '',
      ttlSeconds: isNaN(ttlSeconds) ? ASK_TTL_SECONDS : ttlSeconds, // Ensure valid number
      txHash: txHashMap[entity.key] || getAttr('txHash') || payload.txHash || (entity as any).txHash || undefined,
    };
  });

  if (params?.skill) {
    const skillLower = params.skill.toLowerCase();
    asks = asks.filter(ask => ask.skill.toLowerCase().includes(skillLower));
  }

  return asks;
}

/**
 * List asks for a specific wallet
 * 
 * @param wallet - Wallet address
 * @returns Array of asks for that wallet
 */
export async function listAsksForWallet(wallet: string): Promise<Ask[]> {
  const publicClient = getPublicClient();
  const query = publicClient.buildQuery();
  const [result, txHashResult] = await Promise.all([
    query
      .where(eq('type', 'ask'))
      .where(eq('wallet', wallet))
      .withAttributes(true)
      .withPayload(true)
      .limit(100)
      .fetch(),
    publicClient.buildQuery()
      .where(eq('type', 'ask_txhash'))
      .where(eq('wallet', wallet))
      .withAttributes(true)
      .withPayload(true)
      .limit(100)
      .fetch(),
  ]);

  const txHashMap: Record<string, string> = {};
  txHashResult.entities.forEach((entity: any) => {
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

  return result.entities.map((entity: any) => {
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
      skill: getAttr('skill') || payload.skill || '',
      spaceId: getAttr('spaceId') || payload.spaceId || 'local-dev',
      createdAt: getAttr('createdAt') || payload.createdAt || '',
      status: getAttr('status') || payload.status || 'open',
      message: payload.message || '',
      ttlSeconds: isNaN(ttlSeconds) ? ASK_TTL_SECONDS : ttlSeconds, // Ensure valid number
      txHash: txHashMap[entity.key] || getAttr('txHash') || payload.txHash || (entity as any).txHash || undefined,
    };
  });
}


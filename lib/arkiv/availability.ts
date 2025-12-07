/**
 * Availability CRUD helpers
 * 
 * Handles availability entities for user time blocks.
 * 
 * Based on mentor-graph implementation.
 * 
 * Reference: refs/mentor-graph/examples/basic/create-profile.ts
 */

import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient, getWalletClientFromPrivateKey } from "./client";
import { handleTransactionWithTimeout } from "./transaction-utils";

export type Availability = {
  key: string;
  wallet: string;
  spaceId: string;
  createdAt: string;
  timeBlocks: string; // JSON string or simple text describing time blocks
  timezone: string;
  txHash?: string;
}

/**
 * Create an availability entity
 * 
 * @param data - Availability data
 * @param privateKey - Private key for signing
 * @returns Entity key and transaction hash
 */
export async function createAvailability({
  wallet,
  timeBlocks,
  timezone,
  privateKey,
  spaceId = 'local-dev',
}: {
  wallet: string;
  timeBlocks: string; // Time blocks description (e.g., "Mon-Fri 9am-5pm EST" or JSON)
  timezone: string;
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();
  const createdAt = new Date().toISOString();
  // Use 30 days expiration (like mentor-graph example)
  const expiresIn = 2592000; // 30 days in seconds

  const result = await handleTransactionWithTimeout(async () => {
    return await walletClient.createEntity({
      payload: enc.encode(JSON.stringify({
        timeBlocks,
        timezone,
        createdAt,
      })),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'availability' },
        { key: 'wallet', value: wallet },
        { key: 'spaceId', value: spaceId },
        { key: 'createdAt', value: createdAt },
        { key: 'timezone', value: timezone },
      ],
      expiresIn: expiresIn,
    });
  });

  const { entityKey, txHash } = result;

  // Create separate txhash entity (like mentor-graph pattern)
  // Don't wait for this one - it's optional metadata
  walletClient.createEntity({
    payload: enc.encode(JSON.stringify({
      txHash,
    })),
    contentType: 'application/json',
    attributes: [
      { key: 'type', value: 'availability_txhash' },
      { key: 'availabilityKey', value: entityKey },
      { key: 'wallet', value: wallet },
      { key: 'spaceId', value: spaceId },
    ],
    expiresIn: expiresIn,
  });

  return { key: entityKey, txHash };
}

/**
 * List all availability entities for a wallet
 * 
 * @param wallet - Wallet address
 * @param spaceId - Optional space ID filter
 * @returns Array of availability entities
 */
export async function listAvailabilityForWallet(
  wallet: string,
  spaceId?: string
): Promise<Availability[]> {
  const publicClient = getPublicClient();
  const query = publicClient.buildQuery();
  let queryBuilder = query
    .where(eq('type', 'availability'))
    .where(eq('wallet', wallet.toLowerCase()));

  if (spaceId) {
    queryBuilder = queryBuilder.where(eq('spaceId', spaceId));
  }

  const [result, txHashResult] = await Promise.all([
    queryBuilder.withAttributes(true).withPayload(true).limit(100).fetch(),
    publicClient.buildQuery()
      .where(eq('type', 'availability_txhash'))
      .withAttributes(true)
      .withPayload(true)
      .limit(100)
      .fetch(),
  ]);

  // Build txHash map
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
    const availabilityKey = getAttr('availabilityKey');
    if (availabilityKey) {
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
        txHashMap[availabilityKey] = payload.txHash;
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

    return {
      key: entity.key,
      wallet: getAttr('wallet'),
      spaceId: getAttr('spaceId') || 'local-dev',
      createdAt: getAttr('createdAt'),
      timeBlocks: payload.timeBlocks || '',
      timezone: payload.timezone || getAttr('timezone') || '',
      txHash: txHashMap[entity.key],
    };
  }).sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}


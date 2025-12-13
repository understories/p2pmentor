/**
 * Onboarding Event CRUD helpers
 * 
 * Tracks onboarding progress events (e.g., network_explored).
 * Used to determine onboarding level without creating a dedicated onboarding entity.
 * 
 * Reference: refs/doc/onboarding_levelup_TECHNICAL_QUESTIONS.md
 */

import { eq } from "@arkiv-network/sdk/query";
import { getPublicClient, getWalletClientFromPrivateKey, getWalletClientFromMetaMask } from "./client";
import { handleTransactionWithTimeout } from "./transaction-utils";

export type OnboardingEventType = 'network_explored' | 'onboarding_started' | 'onboarding_completed';

export type OnboardingEvent = {
  key: string;
  wallet: string;
  eventType: OnboardingEventType;
  spaceId: string;
  createdAt: string;
  txHash?: string;
}

/**
 * Create an onboarding event
 * 
 * @param data - Event data
 * @param privateKey - Private key for signing
 * @returns Entity key and transaction hash
 */
export async function createOnboardingEvent({
  wallet,
  eventType,
  privateKey,
  spaceId = 'local-dev',
}: {
  wallet: string;
  eventType: OnboardingEventType;
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const enc = new TextEncoder();
  const createdAt = new Date().toISOString();

  // 1 year TTL (effectively permanent for beta)
  const expiresIn = 31536000;

  const payload = {
    eventType,
    createdAt,
  };

  const { entityKey, txHash } = await handleTransactionWithTimeout(async () => {
    return await walletClient.createEntity({
      payload: enc.encode(JSON.stringify(payload)),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'onboarding_event' },
        { key: 'wallet', value: wallet.toLowerCase() },
        { key: 'eventType', value: eventType },
        { key: 'spaceId', value: spaceId },
        { key: 'createdAt', value: createdAt },
      ],
      expiresIn,
    });
  });

  // Create separate txhash entity (optional metadata, don't wait)
  walletClient.createEntity({
    payload: enc.encode(JSON.stringify({ txHash })),
    contentType: 'application/json',
    attributes: [
      { key: 'type', value: 'onboarding_event_txhash' },
      { key: 'eventKey', value: entityKey },
      { key: 'wallet', value: wallet.toLowerCase() },
      { key: 'spaceId', value: spaceId },
    ],
    expiresIn,
  }).catch((error: any) => {
    console.warn('[createOnboardingEvent] Failed to create txhash entity:', error);
  });

  return { key: entityKey, txHash };
}

/**
 * Create onboarding event (client-side with MetaMask)
 * 
 * @param data - Event data
 * @param account - MetaMask account address
 * @returns Entity key and transaction hash
 */
export async function createOnboardingEventClient({
  wallet,
  eventType,
  account,
  spaceId = 'local-dev',
}: {
  wallet: string;
  eventType: OnboardingEventType;
  account: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  const { getWalletClientFromMetaMask } = await import('./client');
  const walletClient = getWalletClientFromMetaMask(account);
  const enc = new TextEncoder();
  const createdAt = new Date().toISOString();

  // 1 year TTL (effectively permanent for beta)
  const expiresIn = 31536000;

  const payload = {
    eventType,
    createdAt,
  };

  const { entityKey, txHash } = await handleTransactionWithTimeout(async () => {
    return await walletClient.createEntity({
      payload: enc.encode(JSON.stringify(payload)),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'onboarding_event' },
        { key: 'wallet', value: wallet.toLowerCase() },
        { key: 'eventType', value: eventType },
        { key: 'spaceId', value: spaceId },
        { key: 'createdAt', value: createdAt },
      ],
      expiresIn,
    });
  });

  // Create separate txhash entity (optional metadata, don't wait)
  walletClient.createEntity({
    payload: enc.encode(JSON.stringify({ txHash })),
    contentType: 'application/json',
    attributes: [
      { key: 'type', value: 'onboarding_event_txhash' },
      { key: 'eventKey', value: entityKey },
      { key: 'wallet', value: wallet.toLowerCase() },
      { key: 'spaceId', value: spaceId },
    ],
    expiresIn,
  }).catch((error: any) => {
    console.warn('[createOnboardingEventClient] Failed to create txhash entity:', error);
  });

  return { key: entityKey, txHash };
}

/**
 * List onboarding events for a wallet
 * 
 * @param params - Query parameters
 * @returns Array of onboarding events
 */
export async function listOnboardingEvents({
  wallet,
  eventType,
  limit = 100,
  spaceId = 'local-dev',
}: {
  wallet: string;
  eventType?: OnboardingEventType;
  limit?: number;
  spaceId?: string;
}): Promise<OnboardingEvent[]> {
  const publicClient = getPublicClient();
  const query = publicClient.buildQuery();

  try {
    let queryBuilder = query
      .where(eq('type', 'onboarding_event'))
      .where(eq('wallet', wallet.toLowerCase()))
      .where(eq('spaceId', spaceId))
      .withAttributes(true)
      .withPayload(true)
      .limit(limit);

    if (eventType) {
      queryBuilder = queryBuilder.where(eq('eventType', eventType));
    }

    const result = await queryBuilder.fetch();

    if (!result?.entities || !Array.isArray(result.entities)) {
      console.warn('[listOnboardingEvents] Invalid result structure, returning empty array', { result });
      return [];
    }

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
        console.error('[listOnboardingEvents] Error decoding payload:', e);
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
        eventType: getAttr('eventType') as OnboardingEventType,
        spaceId: getAttr('spaceId'),
        createdAt: getAttr('createdAt'),
        txHash: payload.txHash || undefined,
      };
    });
  } catch (error: any) {
    console.error('[listOnboardingEvents] Arkiv query failed:', {
      message: error?.message,
      stack: error?.stack,
      error,
    });
    return [];
  }
}

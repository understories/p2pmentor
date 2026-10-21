/**
 * Onboarding Event CRUD helpers
 *
 * Tracks onboarding progress events (e.g., network_explored).
 * Used to determine onboarding level without creating a dedicated onboarding entity.
 *
 * Reference: refs/doc/onboarding_levelup_TECHNICAL_QUESTIONS.md
 */

import { eqAttr } from '@/lib/arkiv/schema';
import { arkivSelect, fetchAll, getAttr as readAttr } from '@/lib/arkiv/read';
import { getPublicClient, getWalletClientFromPrivateKey } from './client';
import { handleTransactionWithTimeout } from './transaction-utils';
import { createArkivEntity } from './write';
import { SPACE_ID } from '@/lib/config';

export type OnboardingEventType =
  | 'network_explored'
  | 'onboarding_started'
  | 'onboarding_completed';

export type OnboardingEvent = {
  key: string;
  wallet: string;
  eventType: OnboardingEventType;
  spaceId: string;
  createdAt: string;
  txHash?: string;
};

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
  spaceId = SPACE_ID,
}: {
  wallet: string;
  eventType: OnboardingEventType;
  privateKey: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  const walletClient = getWalletClientFromPrivateKey(privateKey);
  const createdAt = new Date().toISOString();

  // Lifetime: onboarding_event type default (see lib/arkiv/schema.ts); readonly type

  const payload = {
    eventType,
    createdAt,
  };

  const { entityKey, txHash } = await handleTransactionWithTimeout(async () => {
    return await createArkivEntity(walletClient, {
      type: 'onboarding_event',
      attributes: {
        wallet: wallet.toLowerCase(),
        event_type: eventType,
        space_id: spaceId,
        created_at: createdAt,
      },
      payload,
    });
  });

  // Create separate txhash entity (optional metadata, don't wait)
  createArkivEntity(walletClient, {
    type: 'onboarding_event_txhash',
    attributes: {
      event_key: entityKey,
      wallet: wallet.toLowerCase(),
      space_id: spaceId,
    },
    payload: { txHash },
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
  spaceId = SPACE_ID,
}: {
  wallet: string;
  eventType: OnboardingEventType;
  account: `0x${string}`;
  spaceId?: string;
}): Promise<{ key: string; txHash: string }> {
  const { getWalletClientFromMetaMask } = await import('./client');
  const walletClient = getWalletClientFromMetaMask(account);
  const createdAt = new Date().toISOString();

  // Lifetime: onboarding_event type default (see lib/arkiv/schema.ts); readonly type

  const payload = {
    eventType,
    createdAt,
  };

  const { entityKey, txHash } = await handleTransactionWithTimeout(async () => {
    return await createArkivEntity(walletClient, {
      type: 'onboarding_event',
      attributes: {
        wallet: wallet.toLowerCase(),
        event_type: eventType,
        space_id: spaceId,
        created_at: createdAt,
      },
      payload,
    });
  });

  // Create separate txhash entity (optional metadata, don't wait)
  createArkivEntity(walletClient, {
    type: 'onboarding_event_txhash',
    attributes: {
      event_key: entityKey,
      wallet: wallet.toLowerCase(),
      space_id: spaceId,
    },
    payload: { txHash },
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
  spaceId = SPACE_ID,
}: {
  wallet: string;
  eventType?: OnboardingEventType;
  limit?: number;
  spaceId?: string;
}): Promise<OnboardingEvent[]> {
  const publicClient = getPublicClient();
  try {
    let queryBuilder = arkivSelect('onboarding_event', publicClient)
      .where(eqAttr('wallet', wallet.toLowerCase()))
      .where(eqAttr('space_id', spaceId));

    if (eventType) {
      queryBuilder = queryBuilder.where(eqAttr('event_type', eventType));
    }

    const result = await fetchAll(queryBuilder, limit, publicClient);

    if (!result?.entities || !Array.isArray(result.entities)) {
      console.warn('[listOnboardingEvents] Invalid result structure, returning empty array', {
        result,
      });
      return [];
    }

    return result.entities.map((entity: any) => {
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
        console.error('[listOnboardingEvents] Error decoding payload:', e);
      }

      const getAttr = (key: string): string => readAttr(entity, key);

      return {
        key: entity.key,
        wallet: getAttr('wallet'),
        eventType: getAttr('event_type') as OnboardingEventType,
        spaceId: getAttr('space_id'),
        createdAt: getAttr('created_at'),
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

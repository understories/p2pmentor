/**
 * Quest Reflection Entity Functions
 *
 * Stores "explain in your own words" reflections as Arkiv entities.
 * Reflections are linked to quest step progress and support
 * public/private visibility (user opt-in only).
 *
 * Week 2 (Feb 8-14) - Intrinsic motivation design
 */

import { eq } from '@arkiv-network/sdk/query';
import { getPublicClient, getWalletClientFromPrivateKey } from './client';
import { handleTransactionWithTimeout } from './transaction-utils';
import { SPACE_ID } from '../config';

export type ReflectionVisibility = 'private' | 'public';

export interface QuestReflection {
  key: string;
  wallet: string;
  questId: string;
  stepId: string;
  prompt: string;
  reflectionText: string;
  visibility: ReflectionVisibility;
  progressEntityKey?: string;
  createdAt: string;
  spaceId: string;
  txHash?: string;
}

/**
 * Create a quest reflection entity
 *
 * Entity key pattern (Pattern B - stable keys):
 * quest_reflection:${spaceId}:${wallet}:${questId}:${stepId}
 *
 * Uses stable key so a user can update their reflection for a step
 * (Arkiv will create a new version).
 */
export async function createQuestReflection({
  wallet,
  questId,
  stepId,
  prompt,
  reflectionText,
  visibility = 'private',
  progressEntityKey,
  privateKey,
  spaceId = SPACE_ID,
  ttlSeconds = 31536000,
}: {
  wallet: string;
  questId: string;
  stepId: string;
  prompt: string;
  reflectionText: string;
  visibility?: ReflectionVisibility;
  progressEntityKey?: string;
  privateKey: `0x${string}`;
  spaceId?: string;
  ttlSeconds?: number;
}): Promise<{ key: string; txHash: string }> {
  const normalizedWallet = wallet.toLowerCase();
  const finalSpaceId = spaceId || SPACE_ID;
  const createdAt = new Date().toISOString();

  try {
    const walletClient = getWalletClientFromPrivateKey(privateKey);
    const enc = new TextEncoder();

    const attributes = [
      { key: 'type', value: 'quest_reflection' },
      { key: 'wallet', value: normalizedWallet },
      { key: 'questId', value: questId },
      { key: 'stepId', value: stepId },
      { key: 'visibility', value: visibility },
      { key: 'spaceId', value: finalSpaceId },
      { key: 'createdAt', value: createdAt },
    ];

    const payload = {
      prompt,
      reflectionText,
      progressEntityKey: progressEntityKey || undefined,
    };

    const result = await handleTransactionWithTimeout(async () => {
      return await walletClient.createEntity({
        payload: enc.encode(JSON.stringify(payload)),
        contentType: 'application/json',
        attributes,
        expiresIn: ttlSeconds,
      });
    });

    const returnedEntityKey = result.entityKey;
    const txHash = result.txHash;

    walletClient
      .createEntity({
        payload: enc.encode(JSON.stringify({ txHash, reflectionKey: returnedEntityKey })),
        contentType: 'application/json',
        attributes: [
          { key: 'type', value: 'quest_reflection_txhash' },
          { key: 'reflectionKey', value: returnedEntityKey },
          { key: 'txHash', value: txHash },
          { key: 'spaceId', value: finalSpaceId },
          { key: 'createdAt', value: createdAt },
        ],
        expiresIn: ttlSeconds,
      })
      .catch((err) => {
        console.warn('[createQuestReflection] Failed to create txhash entity:', err);
      });

    return { key: returnedEntityKey, txHash };
  } catch (error: any) {
    console.error('[createQuestReflection] Error:', error);
    throw error;
  }
}

/**
 * Get quest reflections for a user
 */
export async function getQuestReflections({
  wallet,
  questId,
  stepId,
  visibility,
  spaceId = SPACE_ID,
}: {
  wallet?: string;
  questId?: string;
  stepId?: string;
  visibility?: ReflectionVisibility;
  spaceId?: string;
}): Promise<QuestReflection[]> {
  const finalSpaceId = spaceId || SPACE_ID;

  try {
    const publicClient = getPublicClient();
    const query = publicClient.buildQuery();

    let queryBuilder = query
      .where(eq('type', 'quest_reflection'))
      .where(eq('spaceId', finalSpaceId));

    if (wallet) {
      queryBuilder = queryBuilder.where(eq('wallet', wallet.toLowerCase()));
    }
    if (questId) {
      queryBuilder = queryBuilder.where(eq('questId', questId));
    }
    if (stepId) {
      queryBuilder = queryBuilder.where(eq('stepId', stepId));
    }
    if (visibility) {
      queryBuilder = queryBuilder.where(eq('visibility', visibility));
    }

    const result = await queryBuilder.withAttributes(true).withPayload(true).limit(100).fetch();

    if (!result || !result.entities || !Array.isArray(result.entities)) {
      console.warn('[getQuestReflections] Invalid result structure, returning empty array');
      return [];
    }

    return result.entities.map((entity: any) => {
      const getAttr = (key: string) => entity.attributes?.find((a: any) => a.key === key)?.value;

      let payload: any = {};
      try {
        if (entity.payload) {
          const payloadStr =
            typeof entity.payload === 'string'
              ? entity.payload
              : new TextDecoder().decode(entity.payload);
          payload = JSON.parse(payloadStr);
        }
      } catch (e) {
        console.warn('[getQuestReflections] Failed to parse payload:', e);
      }

      return {
        key: entity.key || '',
        wallet: getAttr('wallet') || '',
        questId: getAttr('questId') || '',
        stepId: getAttr('stepId') || '',
        prompt: payload.prompt || '',
        reflectionText: payload.reflectionText || '',
        visibility: (getAttr('visibility') || 'private') as ReflectionVisibility,
        progressEntityKey: payload.progressEntityKey,
        createdAt: getAttr('createdAt') || '',
        spaceId: getAttr('spaceId') || finalSpaceId,
        txHash: entity.txHash,
      };
    });
  } catch (error: any) {
    console.error('[getQuestReflections] Query failed:', error);
    return [];
  }
}

/**
 * List all reflections across all users (for explorer).
 */
export async function listAllReflections({
  spaceIds,
  limit = 1000,
}: {
  spaceIds?: string[];
  limit?: number;
} = {}): Promise<QuestReflection[]> {
  try {
    const publicClient = getPublicClient();

    const fetchForSpace = async (spaceId: string): Promise<QuestReflection[]> => {
      const result = await publicClient
        .buildQuery()
        .where(eq('type', 'quest_reflection'))
        .where(eq('spaceId', spaceId))
        .withAttributes(true)
        .withPayload(false)
        .limit(limit)
        .fetch();

      if (!result?.entities || !Array.isArray(result.entities)) return [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const getAttr = (entity: any, key: string): string => {
        const attrs = entity.attributes || {};
        if (Array.isArray(attrs)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const attr = attrs.find((a: any) => a.key === key);
          return String(attr?.value || '');
        }
        return String(attrs[key] || '');
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return result.entities.map((entity: any) => ({
        key: entity.key,
        wallet: getAttr(entity, 'wallet'),
        questId: getAttr(entity, 'questId'),
        stepId: getAttr(entity, 'stepId'),
        prompt: '',
        reflectionText: '',
        visibility: (getAttr(entity, 'visibility') || 'private') as ReflectionVisibility,
        createdAt: getAttr(entity, 'createdAt'),
        spaceId: getAttr(entity, 'spaceId'),
        txHash: entity.txHash || undefined,
      }));
    };

    if (spaceIds && spaceIds.length > 0) {
      const results = await Promise.all(spaceIds.map(fetchForSpace));
      return results.flat();
    }

    return await fetchForSpace(SPACE_ID);
  } catch (error: unknown) {
    console.error('[listAllReflections] Error:', error);
    return [];
  }
}

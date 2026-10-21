/**
 * Quest Reflection Entity Functions
 *
 * Stores "explain in your own words" reflections as Arkiv entities.
 * Reflections are linked to quest step progress and support
 * public/private visibility (user opt-in only).
 *
 * Week 2 (Feb 8-14) - Intrinsic motivation design
 */

import { eqAttr } from '@/lib/arkiv/schema';
import { arkivSelect, fetchAll, getAttr as readAttr, parsePayload } from '@/lib/arkiv/read';
import { getPublicClient, getWalletClientFromPrivateKey } from './client';
import { handleTransactionWithTimeout } from './transaction-utils';
import { createArkivEntity } from './write';
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
  ttlSeconds, // Optional lifetime override; defaults to the type lifetime (schema.ts)
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

    const attributes = {
      wallet: normalizedWallet,
      quest_id: questId,
      step_id: stepId,
      visibility,
      space_id: finalSpaceId,
      created_at: createdAt,
    };

    const payload = {
      prompt,
      reflectionText,
      progressEntityKey: progressEntityKey || undefined,
    };

    const result = await handleTransactionWithTimeout(async () => {
      return await createArkivEntity(walletClient, {
        type: 'quest_reflection',
        attributes,
        payload,
        lifetimeSeconds: ttlSeconds,
      });
    });

    const returnedEntityKey = result.entityKey;
    const txHash = result.txHash;

    createArkivEntity(walletClient, {
      type: 'quest_reflection_txhash',
      attributes: {
        reflection_key: returnedEntityKey,
        tx_hash: txHash,
        space_id: finalSpaceId,
        created_at: createdAt,
      },
      payload: { txHash, reflectionKey: returnedEntityKey },
      lifetimeSeconds: ttlSeconds,
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
    const query = arkivSelect('quest_reflection', publicClient);

    let queryBuilder = query.where(eqAttr('space_id', finalSpaceId));

    if (wallet) {
      queryBuilder = queryBuilder.where(eqAttr('wallet', wallet.toLowerCase()));
    }
    if (questId) {
      queryBuilder = queryBuilder.where(eqAttr('quest_id', questId));
    }
    if (stepId) {
      queryBuilder = queryBuilder.where(eqAttr('step_id', stepId));
    }
    if (visibility) {
      queryBuilder = queryBuilder.where(eqAttr('visibility', visibility));
    }

    const result = await queryBuilder.limit(100).fetch();

    if (!result || !result.entities || !Array.isArray(result.entities)) {
      console.warn('[getQuestReflections] Invalid result structure, returning empty array');
      return [];
    }

    return result.entities.map((entity: any) => {
      const getAttr = (key: string) => readAttr(entity, key);

      const payload: any = parsePayload(entity);

      return {
        key: entity.key || '',
        wallet: getAttr('wallet') || '',
        questId: getAttr('quest_id') || '',
        stepId: getAttr('step_id') || '',
        prompt: payload.prompt || '',
        reflectionText: payload.reflectionText || '',
        visibility: (getAttr('visibility') || 'private') as ReflectionVisibility,
        progressEntityKey: payload.progressEntityKey,
        createdAt: getAttr('created_at') || '',
        spaceId: getAttr('space_id') || finalSpaceId,
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
      const result = await fetchAll(
        arkivSelect('quest_reflection', publicClient).where(eqAttr('space_id', spaceId)),
        limit,
        publicClient
      );

      if (!result?.entities || !Array.isArray(result.entities)) return [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const getAttr = (entity: any, key: string): string => readAttr(entity, key);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return result.entities.map((entity: any) => ({
        key: entity.key,
        wallet: getAttr(entity, 'wallet'),
        questId: getAttr(entity, 'quest_id'),
        stepId: getAttr(entity, 'step_id'),
        prompt: '',
        reflectionText: '',
        visibility: (getAttr(entity, 'visibility') || 'private') as ReflectionVisibility,
        createdAt: getAttr(entity, 'created_at'),
        spaceId: getAttr(entity, 'space_id'),
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

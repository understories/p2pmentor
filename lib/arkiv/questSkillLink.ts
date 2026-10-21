/**
 * Quest Completion Skill Link
 *
 * Links quest step completion to skill profiles.
 * Creates a verifiable link between learning evidence and skills.
 *
 * Week 1 (Feb 1-7) - Skill linkage feature
 */

import { eqAttr } from '@/lib/arkiv/schema';
import { arkivSelect, fetchAll, getAttr as readAttr, parsePayload } from '@/lib/arkiv/read';
import { getPublicClient, getWalletClientFromPrivateKey } from './client';
import { handleTransactionWithTimeout } from './transaction-utils';
import { createArkivEntity } from './write';
import { SPACE_ID } from '../config';

/**
 * Quest completion skill link entity
 */
export interface QuestCompletionSkillLink {
  key: string;
  wallet: string;
  questId: string;
  stepId: string;
  skillId: string; // Skill entity key
  skillName: string; // Skill name for display
  proficiency?: number; // 1-5 proficiency level
  progressEntityKey: string; // Link to quest_step_progress entity
  createdAt: string;
  spaceId: string;
  txHash?: string;
}

/**
 * Create a quest completion skill link
 *
 * Links a quest step completion to a skill profile.
 * Entity key: quest_completion_skill_link:${spaceId}:${wallet}:${questId}:${stepId}:${skillId}
 */
export async function createQuestCompletionSkillLink({
  wallet,
  questId,
  stepId,
  skillId,
  skillName,
  proficiency,
  progressEntityKey,
  privateKey,
  spaceId = SPACE_ID,
  ttlSeconds, // Optional lifetime override; defaults to the type lifetime (schema.ts)
}: {
  wallet: string;
  questId: string;
  stepId: string;
  skillId: string;
  skillName: string;
  proficiency?: number;
  progressEntityKey: string;
  privateKey: `0x${string}`;
  spaceId?: string;
  ttlSeconds?: number;
}): Promise<{ key: string; txHash: string }> {
  const normalizedWallet = wallet.toLowerCase();
  const finalSpaceId = spaceId || SPACE_ID;
  const createdAt = new Date().toISOString();

  // Generate stable entity key (Pattern B)
  const entityKey = `quest_completion_skill_link:${finalSpaceId}:${normalizedWallet}:${questId}:${stepId}:${skillId}`;

  try {
    const walletClient = getWalletClientFromPrivateKey(privateKey);

    // Build attributes (queryable fields)
    const attributes = {
      wallet: normalizedWallet,
      quest_id: questId,
      step_id: stepId,
      skill_id: skillId,
      space_id: finalSpaceId,
      created_at: createdAt,
    };

    // Build payload (non-queryable content)
    const payload = {
      skillName,
      proficiency: proficiency || undefined,
      progressEntityKey,
    };

    const { entityKey: arkivEntityKey, txHash } = await handleTransactionWithTimeout(async () => {
      return await createArkivEntity(walletClient, {
        type: 'quest_completion_skill_link',
        attributes,
        payload,
        lifetimeSeconds: ttlSeconds,
      });
    });

    // Create txhash entity for observability (fire and forget)
    // link_key is the Arkiv entity key: the stable key string exceeds the 128-byte
    // attribute limit, so it is kept in the payload only.
    createArkivEntity(walletClient, {
      type: 'quest_completion_skill_link_txhash',
      attributes: {
        link_key: arkivEntityKey,
        tx_hash: txHash,
        space_id: finalSpaceId,
        created_at: createdAt,
      },
      payload: { txHash, linkKey: entityKey },
      lifetimeSeconds: ttlSeconds,
    })
      .catch((err) => {
        console.warn('[createQuestCompletionSkillLink] Failed to create txhash entity:', err);
      });

    return { key: entityKey, txHash };
  } catch (error: any) {
    console.error('[createQuestCompletionSkillLink] Error:', error);
    throw error;
  }
}

/**
 * Get quest completion skill links for a user
 */
export async function getQuestCompletionSkillLinks({
  wallet,
  questId,
  stepId,
  skillId,
  spaceId = SPACE_ID,
}: {
  wallet?: string;
  questId?: string;
  stepId?: string;
  skillId?: string;
  spaceId?: string;
}): Promise<QuestCompletionSkillLink[]> {
  const finalSpaceId = spaceId || SPACE_ID;

  try {
    const publicClient = getPublicClient();
    const query = arkivSelect('quest_completion_skill_link', publicClient);

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
    if (skillId) {
      queryBuilder = queryBuilder.where(eqAttr('skill_id', skillId));
    }

    const result = await queryBuilder.limit(100).fetch();

    // Defensive check
    if (!result || !result.entities || !Array.isArray(result.entities)) {
      console.warn(
        '[getQuestCompletionSkillLinks] Invalid result structure, returning empty array'
      );
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
        skillId: getAttr('skill_id') || '',
        skillName: payload.skillName || '',
        proficiency: payload.proficiency,
        progressEntityKey: payload.progressEntityKey || '',
        createdAt: getAttr('created_at') || '',
        spaceId: getAttr('space_id') || finalSpaceId,
        txHash: entity.txHash,
      };
    });
  } catch (error: any) {
    console.error('[getQuestCompletionSkillLinks] Query failed:', error);
    return [];
  }
}

/**
 * List all quest skill links across all users (for explorer).
 */
export async function listAllQuestSkillLinks({
  spaceIds,
  limit = 1000,
}: {
  spaceIds?: string[];
  limit?: number;
} = {}): Promise<QuestCompletionSkillLink[]> {
  try {
    const publicClient = getPublicClient();

    const fetchForSpace = async (spaceId: string): Promise<QuestCompletionSkillLink[]> => {
      const result = await fetchAll(
        arkivSelect('quest_completion_skill_link', publicClient).where(eqAttr('space_id', spaceId)),
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
        skillId: getAttr(entity, 'skill_id'),
        skillName: '',
        progressEntityKey: '',
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
    console.error('[listAllQuestSkillLinks] Error:', error);
    return [];
  }
}

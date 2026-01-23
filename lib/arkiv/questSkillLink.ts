/**
 * Quest Completion Skill Link
 *
 * Links quest step completion to skill profiles.
 * Creates a verifiable link between learning evidence and skills.
 *
 * Week 1 (Feb 1-7) - Skill linkage feature
 */

import { eq } from '@arkiv-network/sdk/query';
import { getPublicClient, getWalletClientFromPrivateKey } from './client';
import { handleTransactionWithTimeout } from './transaction-utils';
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
  ttlSeconds = 31536000, // 1 year default
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
    const enc = new TextEncoder();

    // Build attributes (queryable fields)
    const attributes = [
      { key: 'type', value: 'quest_completion_skill_link' },
      { key: 'wallet', value: normalizedWallet },
      { key: 'questId', value: questId },
      { key: 'stepId', value: stepId },
      { key: 'skillId', value: skillId },
      { key: 'spaceId', value: finalSpaceId },
      { key: 'createdAt', value: createdAt },
    ];

    // Build payload (non-queryable content)
    const payload = {
      skillName,
      proficiency: proficiency || undefined,
      progressEntityKey,
    };

    const { txHash } = await handleTransactionWithTimeout(async () => {
      return await walletClient.createEntity({
        payload: enc.encode(JSON.stringify(payload)),
        contentType: 'application/json',
        attributes,
        expiresIn: ttlSeconds,
      });
    });

    // Create txhash entity for observability (fire and forget)
    walletClient.createEntity({
      payload: enc.encode(JSON.stringify({ txHash, linkKey: entityKey })),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'quest_completion_skill_link_txhash' },
        { key: 'linkKey', value: entityKey },
        { key: 'txHash', value: txHash },
        { key: 'spaceId', value: finalSpaceId },
        { key: 'createdAt', value: createdAt },
      ],
      expiresIn: ttlSeconds,
    }).catch((err) => {
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
    const query = publicClient.buildQuery();

    let queryBuilder = query
      .where(eq('type', 'quest_completion_skill_link'))
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
    if (skillId) {
      queryBuilder = queryBuilder.where(eq('skillId', skillId));
    }

    const result = await queryBuilder
      .withAttributes(true)
      .withPayload(true)
      .limit(100)
      .fetch();

    // Defensive check
    if (!result || !result.entities || !Array.isArray(result.entities)) {
      console.warn('[getQuestCompletionSkillLinks] Invalid result structure, returning empty array');
      return [];
    }

    return result.entities.map((entity: any) => {
      const getAttr = (key: string) =>
        entity.attributes?.find((a: any) => a.key === key)?.value;

      let payload: any = {};
      try {
        if (entity.payload) {
          const payloadStr = typeof entity.payload === 'string'
            ? entity.payload
            : new TextDecoder().decode(entity.payload);
          payload = JSON.parse(payloadStr);
        }
      } catch (e) {
        console.warn('[getQuestCompletionSkillLinks] Failed to parse payload:', e);
      }

      return {
        key: entity.key || '',
        wallet: getAttr('wallet') || '',
        questId: getAttr('questId') || '',
        stepId: getAttr('stepId') || '',
        skillId: getAttr('skillId') || '',
        skillName: payload.skillName || '',
        proficiency: payload.proficiency,
        progressEntityKey: payload.progressEntityKey || '',
        createdAt: getAttr('createdAt') || '',
        spaceId: getAttr('spaceId') || finalSpaceId,
        txHash: entity.txHash,
      };
    });
  } catch (error: any) {
    console.error('[getQuestCompletionSkillLinks] Query failed:', error);
    return [];
  }
}

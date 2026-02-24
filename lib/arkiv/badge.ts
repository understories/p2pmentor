/**
 * Badge System
 *
 * Handles Proof of Skill badge issuance for completed quest tracks.
 * Badges are verifiable on-chain credentials tied to wallet addresses.
 *
 * Reference: refs/docs/jan26plan.md - Week 2 Badge Implementation
 */

import { eq } from '@arkiv-network/sdk/query';
import { getPublicClient, getWalletClientFromPrivateKey } from './client';
import { handleTransactionWithTimeout } from './transaction-utils';
import { SPACE_ID } from '../config';
import { getQuestStepProgress } from './questProgress';
import { getRequiredStepIds } from '../quests';

/**
 * Badge types supported by the system
 */
export type BadgeType =
  | 'arkiv_builder'
  | 'mandarin_starter'
  | 'spanish_starter'
  | 'crypto_basics' // Quest badge ID: crypto_basics
  | 'cryptography_basics' // Legacy/alternative name
  | 'meta_learner' // Quest badge ID: meta_learner
  | 'privacy_fundamentals'
  | 'ai_intro';

/**
 * Badge entity stored on Arkiv
 */
export interface ProofOfSkillBadge {
  key: string;
  wallet: string;
  badgeType: BadgeType;
  questId: string;
  issuedAt: string;
  evidenceRefs: Array<{
    stepId: string;
    entityKey: string;
    txHash?: string;
  }>;
  questVersion: string; // Quest version this badge was earned on
  version: string; // Badge schema version
  issuer: string;
  spaceId: string;
  txHash?: string;
}

/**
 * Issue a Proof of Skill badge
 *
 * Creates a badge entity on Arkiv that proves a user completed a quest track.
 * The badge includes references to all step completion evidence.
 */
export async function issueBadge({
  wallet,
  badgeType,
  questId,
  questVersion,
  evidenceRefs,
  privateKey,
  spaceId = SPACE_ID,
  ttlSeconds = 31536000, // 1 year default
}: {
  wallet: string;
  badgeType: BadgeType;
  questId: string;
  questVersion: string; // Quest version this badge is for
  evidenceRefs: Array<{ stepId: string; entityKey: string; txHash?: string }>;
  privateKey: `0x${string}`;
  spaceId?: string;
  ttlSeconds?: number;
}): Promise<{ key: string; txHash: string }> {
  const normalizedWallet = wallet.toLowerCase();
  const finalSpaceId = spaceId || SPACE_ID;
  const createdAt = new Date().toISOString();

  // Generate stable entity key (Pattern B)
  const entityKey = `badge:${finalSpaceId}:${normalizedWallet}:${badgeType}`;

  try {
    const walletClient = getWalletClientFromPrivateKey(privateKey);
    const enc = new TextEncoder();

    // Build attributes (queryable fields)
    const attributes = [
      { key: 'type', value: 'proof_of_skill_badge' },
      { key: 'wallet', value: normalizedWallet },
      { key: 'badgeType', value: badgeType },
      { key: 'questId', value: questId },
      { key: 'spaceId', value: finalSpaceId },
      { key: 'issuedAt', value: createdAt },
    ];

    // Build payload (non-queryable content)
    const payload = {
      evidenceRefs,
      questVersion: questVersion || '1', // Default to '1' for backward compatibility
      version: '1', // Badge schema version
      issuer: 'p2pmentor',
    };

    // Submit with timeout wrapper
    const result = await handleTransactionWithTimeout(async () => {
      return await walletClient.createEntity({
        payload: enc.encode(JSON.stringify(payload)),
        contentType: 'application/json',
        attributes,
        expiresIn: ttlSeconds,
      });
    });

    const txHash = result.txHash;

    // Create parallel txhash entity for observability (fire and forget)
    walletClient
      .createEntity({
        payload: enc.encode(JSON.stringify({ txHash, badgeKey: entityKey })),
        contentType: 'application/json',
        attributes: [
          { key: 'type', value: 'proof_of_skill_badge_txhash' },
          { key: 'badgeKey', value: entityKey },
          { key: 'txHash', value: txHash },
          { key: 'wallet', value: normalizedWallet },
          { key: 'spaceId', value: finalSpaceId },
          { key: 'createdAt', value: createdAt },
        ],
        expiresIn: ttlSeconds,
      })
      .catch((err) => {
        // Non-blocking - log but don't fail
        console.warn('[issueBadge] Failed to create txhash entity:', err);
      });

    return {
      key: entityKey,
      txHash,
    };
  } catch (error: any) {
    console.error('[issueBadge] Error:', error);
    throw new Error(`Failed to issue badge: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Check if a user is eligible for a badge
 *
 * Verifies that all required steps for a quest have been completed.
 * Returns eligibility status and lists of completed/missing steps.
 */
export async function checkBadgeEligibility({
  wallet,
  questId,
  trackId,
  spaceId = SPACE_ID,
}: {
  wallet: string;
  questId: string;
  trackId: string;
  spaceId?: string;
}): Promise<{
  eligible: boolean;
  completedSteps: string[];
  missingSteps: string[];
  evidenceRefs: Array<{ stepId: string; entityKey: string; txHash?: string }>;
  questVersion?: string; // Quest version from progress (if available)
}> {
  const normalizedWallet = wallet.toLowerCase();

  // Get required step IDs
  const requiredStepIds = await getRequiredStepIds(trackId);
  if (requiredStepIds.length === 0) {
    return {
      eligible: false,
      completedSteps: [],
      missingSteps: [],
      evidenceRefs: [],
    };
  }

  // Get all progress for this quest
  const progress = await getQuestStepProgress({ wallet, questId, spaceId });

  // Extract questVersion from progress (use most common version, or first found)
  const questVersion = progress.find((p) => p.questVersion)?.questVersion || '1';

  // Build evidence refs and check completion
  const completedStepIds: string[] = [];
  const evidenceRefs: Array<{ stepId: string; entityKey: string; txHash?: string }> = [];

  progress.forEach((p) => {
    if (requiredStepIds.includes(p.stepId)) {
      completedStepIds.push(p.stepId);
      evidenceRefs.push({
        stepId: p.stepId,
        entityKey: p.key,
        txHash: p.txHash,
      });
    }
  });

  const missingSteps = requiredStepIds.filter((id) => !completedStepIds.includes(id));

  return {
    eligible: missingSteps.length === 0,
    completedSteps: completedStepIds,
    missingSteps,
    evidenceRefs,
    questVersion,
  };
}

/**
 * Get all badges for a user
 *
 * Queries all badge entities for a specific wallet.
 */
export async function getUserBadges({
  wallet,
  spaceId = SPACE_ID,
}: {
  wallet: string;
  spaceId?: string;
}): Promise<ProofOfSkillBadge[]> {
  const normalizedWallet = wallet.toLowerCase();
  const finalSpaceId = spaceId || SPACE_ID;

  try {
    const publicClient = getPublicClient();
    const query = publicClient.buildQuery();

    const result = await query
      .where(eq('type', 'proof_of_skill_badge'))
      .where(eq('wallet', normalizedWallet))
      .where(eq('spaceId', finalSpaceId))
      .withAttributes(true)
      .withPayload(true)
      .limit(100)
      .fetch();

    // Defensive check
    if (!result || !result.entities || !Array.isArray(result.entities)) {
      console.warn('[getUserBadges] Invalid result structure, returning empty array');
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
        console.warn('[getUserBadges] Failed to parse payload:', e);
      }

      return {
        key: entity.key || '',
        wallet: getAttr('wallet') || normalizedWallet,
        badgeType: (getAttr('badgeType') || 'arkiv_builder') as BadgeType,
        questId: getAttr('questId') || '',
        issuedAt: getAttr('issuedAt') || '',
        evidenceRefs: payload.evidenceRefs || [],
        questVersion: payload.questVersion || '1', // Default to '1' for backward compatibility
        version: payload.version || '1',
        issuer: payload.issuer || 'p2pmentor',
        spaceId: getAttr('spaceId') || finalSpaceId,
        txHash: entity.txHash,
      };
    });
  } catch (error: any) {
    console.error('[getUserBadges] Query failed:', error);
    return [];
  }
}

/**
 * Check if user has a specific badge
 *
 * Returns the badge entity if found, null otherwise.
 */
export async function getUserBadge({
  wallet,
  badgeType,
  spaceId = SPACE_ID,
}: {
  wallet: string;
  badgeType: BadgeType;
  spaceId?: string;
}): Promise<ProofOfSkillBadge | null> {
  const badges = await getUserBadges({ wallet, spaceId });
  return badges.find((b) => b.badgeType === badgeType) || null;
}

/**
 * List all badges across all users (for explorer).
 */
export async function listAllBadges({
  spaceIds,
  limit = 1000,
}: {
  spaceIds?: string[];
  limit?: number;
} = {}): Promise<ProofOfSkillBadge[]> {
  try {
    const publicClient = getPublicClient();

    const fetchForSpace = async (spaceId: string): Promise<ProofOfSkillBadge[]> => {
      const result = await publicClient
        .buildQuery()
        .where(eq('type', 'proof_of_skill_badge'))
        .where(eq('spaceId', spaceId))
        .withAttributes(true)
        .withPayload(true)
        .limit(limit)
        .fetch();

      if (!result?.entities || !Array.isArray(result.entities)) return [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return result.entities.map((entity: any) => {
        const attrs = entity.attributes || {};
        const getAttr = (key: string): string => {
          if (Array.isArray(attrs)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const attr = attrs.find((a: any) => a.key === key);
            return String(attr?.value || '');
          }
          return String(attrs[key] || '');
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        } catch {
          // Silently ignore payload decoding errors
        }

        return {
          key: entity.key,
          wallet: getAttr('wallet'),
          badgeType: getAttr('badgeType') as BadgeType,
          questId: getAttr('questId'),
          issuedAt: getAttr('issuedAt'),
          evidenceRefs: payload.evidenceRefs || [],
          questVersion: payload.questVersion || '1',
          version: payload.version || '1',
          issuer: payload.issuer || 'p2pmentor',
          spaceId: getAttr('spaceId') || spaceId,
          txHash: entity.txHash,
        };
      });
    };

    if (spaceIds && spaceIds.length > 0) {
      const results = await Promise.all(spaceIds.map(fetchForSpace));
      return results.flat();
    }

    return await fetchForSpace(SPACE_ID);
  } catch (error: unknown) {
    console.error('[listAllBadges] Error:', error);
    return [];
  }
}

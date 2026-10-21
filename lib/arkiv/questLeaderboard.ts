/**
 * Quest Leaderboard Functions
 *
 * Proof-first leaderboard: shows completion counts and evidence,
 * not arbitrary points. Queries badge entities to build rankings.
 *
 * Week 4 (Feb 22-29) - Partner-ready weekly quests
 */

import { eqAttr } from '@/lib/arkiv/schema';
import { arkivSelect, fetchAll, getAttr as readAttr } from '@/lib/arkiv/read';
import { getPublicClient } from './client';
import { SPACE_ID } from '../config';

export interface LeaderboardEntry {
  wallet: string;
  badgeCount: number;
  badges: {
    badgeType: string;
    questId: string;
    issuedAt: string;
    entityKey: string;
  }[];
  completedQuestIds: string[];
}

/**
 * Get quest completion leaderboard
 *
 * Queries proof_of_skill_badge entities and ranks by count.
 * This is proof-first: every entry is backed by verifiable badge entities.
 */
export async function getQuestLeaderboard({
  questId,
  spaceId = SPACE_ID,
  limit = 20,
}: {
  questId?: string;
  spaceId?: string;
  limit?: number;
}): Promise<LeaderboardEntry[]> {
  const finalSpaceId = spaceId || SPACE_ID;

  try {
    const publicClient = getPublicClient();
    const query = arkivSelect('proof_of_skill_badge', publicClient);

    let queryBuilder = query.where(eqAttr('space_id', finalSpaceId));

    if (questId) {
      queryBuilder = queryBuilder.where(eqAttr('quest_id', questId));
    }

    const result = await fetchAll(queryBuilder, 500, publicClient);

    if (!result || !result.entities || !Array.isArray(result.entities)) {
      return [];
    }

    const walletMap = new Map<string, LeaderboardEntry>();

    for (const entity of result.entities) {
      const getAttr = (key: string): string => readAttr(entity, key);

      const wallet = getAttr('wallet').toLowerCase();
      if (!wallet) continue;

      const badgeType = getAttr('badge_type');
      const entityQuestId = getAttr('quest_id');
      const issuedAt = getAttr('issued_at');

      const existing = walletMap.get(wallet) || {
        wallet,
        badgeCount: 0,
        badges: [],
        completedQuestIds: [],
      };

      existing.badgeCount += 1;
      existing.badges.push({
        badgeType,
        questId: entityQuestId,
        issuedAt,
        entityKey: entity.key || '',
      });
      if (entityQuestId && !existing.completedQuestIds.includes(entityQuestId)) {
        existing.completedQuestIds.push(entityQuestId);
      }

      walletMap.set(wallet, existing);
    }

    return Array.from(walletMap.values())
      .sort((a, b) => b.badgeCount - a.badgeCount)
      .slice(0, limit);
  } catch (error: any) {
    console.error('[getQuestLeaderboard] Query failed:', error);
    return [];
  }
}

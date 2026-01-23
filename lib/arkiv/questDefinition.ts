/**
 * Quest Definition Entity CRUD
 *
 * Arkiv-native implementation for quest definitions.
 * Stores quest definitions as entities on Arkiv for network-wide discovery.
 *
 * Reference: refs/docs/quest-architecture-questions.md
 */

import { eq } from '@arkiv-network/sdk/query';
import { getPublicClient, getWalletClientFromPrivateKey } from './client';
import { handleTransactionWithTimeout } from './transaction-utils';
import { SPACE_ID } from '../config';
import type { QuestDefinition } from '../quests/questFormat';

/**
 * Quest definition entity stored on Arkiv
 */
export interface QuestDefinitionEntity {
  key: string;
  questId: string;
  track: string;
  version: string;
  language?: string;
  spaceId: string;
  status: 'active' | 'archived';
  createdAt: string;
  creatorWallet?: string;
  txHash?: string;
  // Full quest definition in payload
  quest: QuestDefinition;
}

/**
 * Create a quest definition entity
 *
 * Used by sync script to publish quest definitions from files to Arkiv.
 * Follows Pattern A (immutable versions): each version creates a new entity.
 *
 * Entity key: `quest_definition:${track}:v${version}`
 */
export async function createQuestDefinition({
  quest,
  privateKey,
  spaceId = 'global', // Network-wide by default
  creatorWallet,
}: {
  quest: QuestDefinition;
  privateKey: `0x${string}`;
  spaceId?: string;
  creatorWallet?: string;
}): Promise<{ key: string; txHash: string } | null> {
  try {
    const walletClient = getWalletClientFromPrivateKey(privateKey);
    if (!walletClient) {
      throw new Error('Failed to get wallet client');
    }

    const enc = new TextEncoder();
    const createdAt = new Date().toISOString();
    const finalSpaceId = spaceId || 'global';

    // Entity key: quest_definition:${track}:v${version} (Pattern A - immutable versions)
    const entityKey = `quest_definition:${quest.track}:v${quest.version}`;

    // Build attributes (queryable fields)
    const attributes = [
      { key: 'type', value: 'quest_definition' },
      { key: 'questId', value: quest.questId },
      { key: 'track', value: quest.track },
      { key: 'version', value: quest.version },
      ...(quest.track === 'mandarin' || quest.track === 'spanish' 
        ? [{ key: 'language', value: quest.track === 'mandarin' ? 'zh' : 'es' }] 
        : []),
      { key: 'spaceId', value: finalSpaceId },
      { key: 'status', value: 'active' },
      { key: 'createdAt', value: createdAt },
      ...(creatorWallet ? [{ key: 'creatorWallet', value: creatorWallet.toLowerCase() }] : []),
    ];

    // Payload: Full quest definition with inline markdown content
    // Note: Markdown content should already be inlined in quest.steps[].content
    // by the sync script before calling this function
    const payload = quest;

    const { txHash } = await handleTransactionWithTimeout(async () => {
      return await walletClient.createEntity({
        payload: enc.encode(JSON.stringify(payload)),
        contentType: 'application/json',
        attributes,
        // Long-term TTL (10 years - quest definitions are curated content)
        expiresIn: 315360000, // 10 years in seconds
      });
    });

    // Create txhash entity for observability (fire and forget)
    walletClient.createEntity({
      payload: enc.encode(JSON.stringify({ txHash, questKey: entityKey })),
      contentType: 'application/json',
      attributes: [
        { key: 'type', value: 'quest_definition_txhash' },
        { key: 'questKey', value: entityKey },
        { key: 'txHash', value: txHash },
        { key: 'spaceId', value: finalSpaceId },
        { key: 'createdAt', value: createdAt },
      ],
      expiresIn: 315360000, // 10 years (matches quest entity)
    }).catch((err) => {
      // Non-blocking - log but don't fail
      console.warn('[createQuestDefinition] Failed to create txhash entity:', err);
    });

    return { key: entityKey, txHash };
  } catch (error: any) {
    console.error('[createQuestDefinition] Error:', error);
    return null;
  }
}

/**
 * Get a quest definition by questId and version
 *
 * Returns the quest definition entity for a specific version.
 */
export async function getQuestDefinition({
  questId,
  version,
  spaceId,
}: {
  questId: string;
  version: string;
  spaceId?: string;
}): Promise<QuestDefinitionEntity | null> {
  try {
    const publicClient = getPublicClient();
    const query = publicClient.buildQuery();

    const finalSpaceId = spaceId || 'global';

    const result = await query
      .where(eq('type', 'quest_definition'))
      .where(eq('questId', questId))
      .where(eq('version', version))
      .where(eq('spaceId', finalSpaceId))
      .where(eq('status', 'active'))
      .withAttributes(true)
      .withPayload(true)
      .limit(1)
      .fetch();

    if (!result?.entities || result.entities.length === 0) {
      return null;
    }

    const entity = result.entities[0];
    return parseQuestDefinitionEntity(entity);
  } catch (error: any) {
    console.error('[getQuestDefinition] Query failed:', error);
    return null;
  }
}

/**
 * Get the latest version of a quest
 *
 * Queries all versions and returns the most recent (by createdAt).
 */
export async function getLatestQuestDefinition({
  questId,
  spaceId,
}: {
  questId: string;
  spaceId?: string;
}): Promise<QuestDefinitionEntity | null> {
  try {
    const publicClient = getPublicClient();
    const query = publicClient.buildQuery();

    const finalSpaceId = spaceId || 'global';

    const result = await query
      .where(eq('type', 'quest_definition'))
      .where(eq('questId', questId))
      .where(eq('spaceId', finalSpaceId))
      .where(eq('status', 'active'))
      .withAttributes(true)
      .withPayload(true)
      .limit(100) // Get all versions, sort client-side
      .fetch();

    if (!result?.entities || result.entities.length === 0) {
      return null;
    }

    // Parse and sort by createdAt (most recent first)
    const quests = result.entities
      .map(parseQuestDefinitionEntity)
      .filter((q): q is QuestDefinitionEntity => q !== null)
      .sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    return quests[0] || null;
  } catch (error: any) {
    console.error('[getLatestQuestDefinition] Query failed:', error);
    return null;
  }
}

/**
 * List all quest definitions
 *
 * Optionally filter by track, language, and spaceId.
 */
export async function listQuestDefinitions({
  track,
  language,
  spaceId,
}: {
  track?: string;
  language?: string;
  spaceId?: string;
} = {}): Promise<QuestDefinitionEntity[]> {
  try {
    const publicClient = getPublicClient();
    const query = publicClient.buildQuery();

    const finalSpaceId = spaceId || 'global';

    let queryBuilder = query
      .where(eq('type', 'quest_definition'))
      .where(eq('status', 'active'))
      .where(eq('spaceId', finalSpaceId))
      .withAttributes(true)
      .withPayload(true)
      .limit(100);

    if (track) {
      queryBuilder = queryBuilder.where(eq('track', track));
    }

    if (language) {
      queryBuilder = queryBuilder.where(eq('language', language));
    }

    const result = await queryBuilder.fetch();

    if (!result?.entities || !Array.isArray(result.entities)) {
      return [];
    }

    // Parse entities and get latest version per questId
    const questMap = new Map<string, QuestDefinitionEntity>();

    result.entities.forEach((entity) => {
      const quest = parseQuestDefinitionEntity(entity);
      if (!quest) return;

      const existing = questMap.get(quest.questId);
      if (!existing || new Date(quest.createdAt) > new Date(existing.createdAt)) {
        questMap.set(quest.questId, quest);
      }
    });

    return Array.from(questMap.values());
  } catch (error: any) {
    console.error('[listQuestDefinitions] Query failed:', error);
    return [];
  }
}

/**
 * Parse entity into QuestDefinitionEntity
 */
function parseQuestDefinitionEntity(entity: any): QuestDefinitionEntity | null {
  try {
    const getAttr = (key: string) =>
      entity.attributes?.find((a: any) => a.key === key)?.value;

    let payload: QuestDefinition;
    try {
      if (entity.payload) {
        const payloadStr = typeof entity.payload === 'string'
          ? entity.payload
          : new TextDecoder().decode(entity.payload);
        payload = JSON.parse(payloadStr) as QuestDefinition;
      } else {
        return null;
      }
    } catch (e) {
      console.warn('[parseQuestDefinitionEntity] Failed to parse payload:', e);
      return null;
    }

    return {
      key: entity.key || '',
      questId: getAttr('questId') || payload.questId,
      track: getAttr('track') || payload.track,
      version: getAttr('version') || payload.version,
      language: getAttr('language') || undefined,
      spaceId: getAttr('spaceId') || 'global',
      status: (getAttr('status') || 'active') as 'active' | 'archived',
      createdAt: getAttr('createdAt') || '',
      creatorWallet: getAttr('creatorWallet') || undefined,
      txHash: entity.txHash,
      quest: payload,
    };
  } catch (error: any) {
    console.error('[parseQuestDefinitionEntity] Error:', error);
    return null;
  }
}

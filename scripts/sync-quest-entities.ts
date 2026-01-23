/**
 * Sync Quest Entities Script
 *
 * Syncs quest definitions from files to Arkiv entities.
 * Reads quest JSON files, inlines markdown content, and creates/updates entities.
 *
 * Usage:
 *   pnpm tsx scripts/sync-quest-entities.ts [trackId]
 *
 * If trackId is provided, only syncs that quest. Otherwise syncs all quests.
 *
 * Reference: refs/docs/quest-architecture-questions.md
 */

import 'dotenv/config';
import { getPrivateKey } from '../lib/config';
import { listQuests, loadQuestDefinition, loadStepContent } from '../lib/quests';
import { createQuestDefinition, getLatestQuestDefinition } from '../lib/arkiv/questDefinition';
import type { QuestDefinition, QuestStepDefinition } from '../lib/quests/questFormat';

/**
 * Inline markdown content into quest steps
 */
async function inlineStepContent(
  quest: QuestDefinition,
  trackId: string
): Promise<QuestDefinition> {
  // Create a copy with inlined content
  const questWithContent: QuestDefinition = {
    ...quest,
    steps: await Promise.all(
      quest.steps.map(async (step) => {
        // If step already has content, keep it (already inlined)
        if ((step as any).content) {
          return step;
        }

        // If step has contentFile, load and inline it
        if (step.contentFile) {
          const content = await loadStepContent(trackId, step.contentFile);
          if (content) {
            return {
              ...step,
              content: content, // Add content field (not in QuestStepDefinition type, but needed for entities)
            } as QuestStepDefinition & { content?: string };
          }
        }

        return step;
      })
    ),
  };

  return questWithContent;
}

/**
 * Check if quest definition changed significantly
 *
 * For now, we create a new version if:
 * - Quest doesn't exist yet (first sync)
 * - Quest structure changed (steps added/removed/reordered)
 * - Quest metadata changed (title, description, etc.)
 *
 * TODO: Implement more sophisticated diffing (e.g., content hash comparison)
 */
function questChanged(
  fileQuest: QuestDefinition,
  entityQuest: QuestDefinition
): boolean {
  // Check metadata
  if (
    fileQuest.title !== entityQuest.title ||
    fileQuest.description !== entityQuest.description ||
    fileQuest.estimatedDuration !== entityQuest.estimatedDuration ||
    fileQuest.difficulty !== entityQuest.difficulty ||
    fileQuest.version !== entityQuest.version
  ) {
    return true;
  }

  // Check step count
  if (fileQuest.steps.length !== entityQuest.steps.length) {
    return true;
  }

  // Check step IDs and order
  const fileStepIds = fileQuest.steps.map((s) => s.stepId);
  const entityStepIds = entityQuest.steps.map((s) => s.stepId);
  if (JSON.stringify(fileStepIds) !== JSON.stringify(entityStepIds)) {
    return true;
  }

  // TODO: Check step content changes (compare content hashes)
  // For now, assume content changes require new version

  return false;
}

/**
 * Sync a single quest
 */
async function syncQuest(trackId: string, privateKey: `0x${string}`): Promise<boolean> {
  try {
    console.log(`[sync-quest-entities] Syncing quest: ${trackId}`);

    // Load quest definition from file
    const fileQuest = await loadQuestDefinition(trackId);
    if (!fileQuest) {
      console.error(`[sync-quest-entities] Quest not found: ${trackId}`);
      return false;
    }

    // Inline markdown content
    const questWithContent = await inlineStepContent(fileQuest, trackId);

    // Check if entity exists
    const existingEntity = await getLatestQuestDefinition({
      questId: questWithContent.questId,
    });

    if (existingEntity) {
      // Check if quest changed
      const changed = questChanged(questWithContent, existingEntity.quest);
      if (!changed) {
        console.log(
          `[sync-quest-entities] Quest ${trackId} unchanged, skipping`
        );
        return true;
      }

      console.log(
        `[sync-quest-entities] Quest ${trackId} changed, creating new version`
      );
      // Note: We don't increment version here - the quest.json file should have
      // the correct version. If it hasn't been incremented, this will create
      // a duplicate entity with the same version (which is fine for now).
    } else {
      console.log(
        `[sync-quest-entities] Quest ${trackId} not found in entities, creating`
      );
    }

    // Create entity
    const result = await createQuestDefinition({
      quest: questWithContent,
      privateKey,
      spaceId: 'global', // Network-wide quests
    });

    if (!result) {
      console.error(`[sync-quest-entities] Failed to create entity for ${trackId}`);
      return false;
    }

    console.log(
      `[sync-quest-entities] ✅ Created entity for ${trackId}: ${result.key} (tx: ${result.txHash})`
    );
    return true;
  } catch (error: any) {
    console.error(`[sync-quest-entities] Error syncing ${trackId}:`, error);
    return false;
  }
}

/**
 * Main sync function
 */
async function main() {
  const trackId = process.argv[2]; // Optional: specific track to sync

  try {
    // Get private key for signing
    const privateKey = getPrivateKey();

    if (trackId) {
      // Sync specific quest
      const success = await syncQuest(trackId, privateKey);
      process.exit(success ? 0 : 1);
    } else {
      // Sync all quests
      console.log('[sync-quest-entities] Syncing all quests...');
      const quests = await listQuests();
      console.log(`[sync-quest-entities] Found ${quests.length} quests`);

      let successCount = 0;
      let failCount = 0;

      for (const quest of quests) {
        const trackId = quest.trackId || quest.track; // Use trackId if available, fallback to track
        if (!trackId) {
          console.warn(`[sync-quest-entities] Skipping quest without trackId: ${quest.questId}`);
          continue;
        }

        const success = await syncQuest(trackId, privateKey);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }

        // Small delay between syncs to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      console.log(
        `[sync-quest-entities] ✅ Sync complete: ${successCount} succeeded, ${failCount} failed`
      );
      process.exit(failCount > 0 ? 1 : 0);
    }
  } catch (error: any) {
    console.error('[sync-quest-entities] Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

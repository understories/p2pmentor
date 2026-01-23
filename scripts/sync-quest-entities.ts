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
    console.log(`\n[sync-quest-entities] 🔄 Syncing quest: ${trackId}`);

    // Load quest definition from file
    const fileQuest = await loadQuestDefinition(trackId);
    if (!fileQuest) {
      console.error(`[sync-quest-entities] ❌ Quest not found: ${trackId}`);
      return false;
    }

    console.log(`[sync-quest-entities]   Quest ID: ${fileQuest.questId}`);
    console.log(`[sync-quest-entities]   Version: ${fileQuest.version}`);
    console.log(`[sync-quest-entities]   Steps: ${fileQuest.steps.length}`);

    // Inline markdown content
    console.log(`[sync-quest-entities]   Inlining markdown content...`);
    const questWithContent = await inlineStepContent(fileQuest, trackId);
    
    // Count steps with content
    const stepsWithContent = questWithContent.steps.filter((s: any) => s.content).length;
    console.log(`[sync-quest-entities]   Steps with content: ${stepsWithContent}/${questWithContent.steps.length}`);

    // Check if entity exists
    console.log(`[sync-quest-entities]   Checking for existing entity...`);
    const existingEntity = await getLatestQuestDefinition({
      questId: questWithContent.questId,
    });

    if (existingEntity) {
      console.log(`[sync-quest-entities]   Found existing entity: ${existingEntity.key} (v${existingEntity.version})`);
      
      // Check if quest changed
      const changed = questChanged(questWithContent, existingEntity.quest);
      if (!changed) {
        console.log(`[sync-quest-entities] ✅ Quest ${trackId} unchanged, skipping`);
        return true;
      }

      console.log(`[sync-quest-entities] ⚠️  Quest ${trackId} changed, creating new version`);
      console.log(`[sync-quest-entities]   File version: ${questWithContent.version}`);
      console.log(`[sync-quest-entities]   Entity version: ${existingEntity.version}`);
      
      // Warn if version not incremented
      if (questWithContent.version === existingEntity.version) {
        console.warn(`[sync-quest-entities] ⚠️  WARNING: Version not incremented! This will create duplicate entity.`);
        console.warn(`[sync-quest-entities]   Consider incrementing version in quest.json before syncing.`);
      }
    } else {
      console.log(`[sync-quest-entities]   No existing entity found, creating new one`);
    }

    // Create entity
    console.log(`[sync-quest-entities]   Creating entity on Arkiv...`);
    const result = await createQuestDefinition({
      quest: questWithContent,
      privateKey,
      spaceId: 'global', // Network-wide quests
    });

    if (!result) {
      console.error(`[sync-quest-entities] ❌ Failed to create entity for ${trackId}`);
      return false;
    }

    console.log(`[sync-quest-entities] ✅ Created entity for ${trackId}`);
    console.log(`[sync-quest-entities]   Entity key: ${result.key}`);
    console.log(`[sync-quest-entities]   Transaction: ${result.txHash}`);
    return true;
  } catch (error: any) {
    console.error(`[sync-quest-entities] ❌ Error syncing ${trackId}:`, error);
    if (error.message) {
      console.error(`[sync-quest-entities]   Error message: ${error.message}`);
    }
    if (error.stack) {
      console.error(`[sync-quest-entities]   Stack trace:`, error.stack);
    }
    return false;
  }
}

/**
 * Main sync function
 */
async function main() {
  const trackId = process.argv[2]; // Optional: specific track to sync

  try {
    console.log('='.repeat(60));
    console.log('[sync-quest-entities] 🚀 Quest Entity Sync Script');
    console.log('='.repeat(60));
    
    // Get private key for signing
    const privateKey = getPrivateKey();
    console.log(`[sync-quest-entities] Using wallet: ${privateKey.slice(0, 10)}...`);

    if (trackId) {
      // Sync specific quest
      console.log(`[sync-quest-entities] Mode: Single quest (${trackId})`);
      const success = await syncQuest(trackId, privateKey);
      console.log('='.repeat(60));
      process.exit(success ? 0 : 1);
    } else {
      // Sync all quests
      console.log(`[sync-quest-entities] Mode: All quests`);
      const quests = await listQuests();
      console.log(`[sync-quest-entities] Found ${quests.length} quest(s) to sync\n`);

      if (quests.length === 0) {
        console.warn('[sync-quest-entities] ⚠️  No quests found. Check content/quests/ directory.');
        process.exit(0);
      }

      let successCount = 0;
      let failCount = 0;
      const failedQuests: string[] = [];

      for (const quest of quests) {
        const trackId = quest.trackId || quest.track; // Use trackId if available, fallback to track
        if (!trackId) {
          console.warn(`[sync-quest-entities] ⚠️  Skipping quest without trackId: ${quest.questId}`);
          failCount++;
          failedQuests.push(quest.questId || 'unknown');
          continue;
        }

        const success = await syncQuest(trackId, privateKey);
        if (success) {
          successCount++;
        } else {
          failCount++;
          failedQuests.push(trackId);
        }

        // Small delay between syncs to avoid rate limiting
        if (quests.length > 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      console.log('\n' + '='.repeat(60));
      console.log('[sync-quest-entities] 📊 Sync Summary');
      console.log('='.repeat(60));
      console.log(`[sync-quest-entities] ✅ Succeeded: ${successCount}`);
      console.log(`[sync-quest-entities] ❌ Failed: ${failCount}`);
      
      if (failedQuests.length > 0) {
        console.log(`[sync-quest-entities] Failed quests: ${failedQuests.join(', ')}`);
      }
      
      console.log('='.repeat(60));
      process.exit(failCount > 0 ? 1 : 0);
    }
  } catch (error: any) {
    console.error('\n[sync-quest-entities] 💥 Fatal error:', error);
    if (error.message) {
      console.error(`[sync-quest-entities]   Error message: ${error.message}`);
    }
    if (error.stack) {
      console.error(`[sync-quest-entities]   Stack trace:`, error.stack);
    }
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

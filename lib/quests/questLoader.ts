/**
 * Quest Loader
 *
 * Loads quest definitions from the content/quests/ directory.
 * Supports both JSON quest files and markdown step content.
 *
 * For server-side use (API routes, build scripts).
 * Client-side should fetch via API.
 *
 * Reference: refs/docs/jan26plan.md - Week 1 Day 5-7
 */

import { promises as fs } from 'fs';
import path from 'path';
import type {
  QuestDefinition,
  LoadedQuest,
  QuestSummary,
  QuestTrack,
} from './questFormat';
import { validateQuestDefinition, createQuestSummary } from './questFormat';

/**
 * Base path for quest content
 */
const QUESTS_BASE_PATH = path.join(process.cwd(), 'content', 'quests');

/**
 * Check if a quest exists
 */
export async function questExists(trackId: string): Promise<boolean> {
  try {
    const questPath = path.join(QUESTS_BASE_PATH, trackId, 'quest.json');
    await fs.access(questPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load quest definition from JSON file
 */
export async function loadQuestDefinition(
  trackId: string
): Promise<QuestDefinition | null> {
  try {
    const questPath = path.join(QUESTS_BASE_PATH, trackId, 'quest.json');
    const content = await fs.readFile(questPath, 'utf-8');
    const quest = JSON.parse(content) as QuestDefinition;

    // Validate structure
    const validation = validateQuestDefinition(quest);
    if (!validation.valid) {
      console.error(`[loadQuestDefinition] Invalid quest ${trackId}:`, validation.errors);
      return null;
    }

    return quest;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // File doesn't exist - not an error, just no quest
      return null;
    }
    console.error(`[loadQuestDefinition] Error loading ${trackId}:`, error);
    return null;
  }
}

/**
 * Load step content from markdown file
 */
export async function loadStepContent(
  trackId: string,
  contentFile: string
): Promise<string | null> {
  try {
    const stepPath = path.join(QUESTS_BASE_PATH, trackId, contentFile);
    const content = await fs.readFile(stepPath, 'utf-8');
    return content;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.warn(`[loadStepContent] Step file not found: ${trackId}/${contentFile}`);
      return null;
    }
    console.error(`[loadStepContent] Error loading ${trackId}/${contentFile}:`, error);
    return null;
  }
}

/**
 * Load a complete quest with all step content resolved
 */
export async function loadQuest(trackId: string): Promise<LoadedQuest | null> {
  const definition = await loadQuestDefinition(trackId);
  if (!definition) {
    return null;
  }

  // Load all step content in parallel
  const stepContent: Record<string, string> = {};
  const contentPromises = definition.steps
    .filter((step) => step.contentFile)
    .map(async (step) => {
      if (step.contentFile) {
        const content = await loadStepContent(trackId, step.contentFile);
        if (content) {
          stepContent[step.stepId] = content;
        }
      }
    });

  await Promise.all(contentPromises);

  return {
    ...definition,
    stepContent,
  };
}

/**
 * List all available quests
 */
export async function listQuests(): Promise<QuestSummary[]> {
  try {
    // Read content/quests directory
    const entries = await fs.readdir(QUESTS_BASE_PATH, { withFileTypes: true });
    const trackIds = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    // Load all quest definitions in parallel
    const questPromises = trackIds.map(async (trackId) => {
      const definition = await loadQuestDefinition(trackId);
      if (definition) {
        const summary = createQuestSummary(definition);
        return { ...summary, trackId }; // Add trackId (directory name) for URL routing
      }
      return null;
    });

    const quests = await Promise.all(questPromises);
    return quests.filter((q): q is QuestSummary & { trackId: string } => q !== null);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // content/quests directory doesn't exist yet
      return [];
    }
    console.error('[listQuests] Error listing quests:', error);
    return [];
  }
}

/**
 * List quests by track
 */
export async function listQuestsByTrack(track: QuestTrack): Promise<QuestSummary[]> {
  const allQuests = await listQuests();
  return allQuests.filter((q) => q.track === track);
}

/**
 * Get the required step IDs for a quest (for badge completion)
 */
export async function getRequiredStepIds(trackId: string): Promise<string[]> {
  const definition = await loadQuestDefinition(trackId);
  if (!definition) {
    return [];
  }

  // If badge specifies required steps, use those
  if (definition.badge?.requiredSteps) {
    return definition.badge.requiredSteps;
  }

  // Otherwise, all required steps must be completed
  return definition.steps
    .filter((step) => step.required)
    .map((step) => step.stepId);
}

/**
 * Check if content/quests directory exists, create if not
 */
export async function ensureQuestsDirectory(): Promise<void> {
  try {
    await fs.mkdir(QUESTS_BASE_PATH, { recursive: true });
  } catch (error: any) {
    if (error.code !== 'EEXIST') {
      console.error('[ensureQuestsDirectory] Error:', error);
    }
  }
}

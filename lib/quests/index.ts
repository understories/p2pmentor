/**
 * Quest Library
 *
 * Provides quest format definitions and loading utilities
 * for the Learning Quest engine.
 */

// Types and validation
export {
  type QuestDifficulty,
  type QuestTrack,
  type QuizQuestion,
  type QuizRubric,
  type VocabItem,
  type QuestStepDefinition,
  type QuestDefinition,
  type LoadedQuest,
  type QuestSummary,
  validateQuestDefinition,
  createQuestSummary,
} from './questFormat';

// Loader functions (server-side only)
export {
  questExists,
  loadQuestDefinition,
  loadStepContent,
  loadQuest,
  listQuests,
  listQuestsByTrack,
  getRequiredStepIds,
  ensureQuestsDirectory,
} from './questLoader';

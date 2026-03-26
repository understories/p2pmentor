# M3 Fix: Server-Side Rubric Loading

## Problem

The quiz scoring endpoint (`POST /api/quests/quiz`) accepted the full rubric
(including correct answers and passing score) from the client request body.
A caller could craft a request with altered `correctAnswer` values or a lower
`passingScore` to guarantee a pass without knowing the real answers.

## Root Cause

`QuizRenderer.tsx` sent `rubric` and `passingScore` in the POST body.
The API route destructured these from `body` and scored directly against them
instead of loading the authoritative rubric from the quest definition.

## Fix (2026-03-26)

### Server (`app/api/quests/quiz/route.ts`)

- Removed `rubric` and `passingScore` from the expected request body.
- Added `resolveQuestDefinition(questId)` helper that loads the quest
  definition server-side, respecting `QUEST_ENTITY_MODE` (entity → file fallback).
- After loading the quest, the route finds the step by `stepId`, resolves
  `quizRubricId` → `quest.rubrics[quizRubricId]`, and scores against that.
- `passingScore` now comes exclusively from the server-loaded rubric.

### Server (`lib/quests/questLoader.ts`)

- Added `loadQuestDefinitionByQuestId(questId)` — scans all track directories
  to find a quest.json whose `questId` field matches. Used as the file-mode
  fallback when the entity store is unavailable.

### Client (`components/quests/QuizRenderer.tsx`)

- Removed `rubric` and `passingScore` from the fetch body.
- Client still receives the rubric for rendering questions/options, but it is
  no longer sent back for scoring.

## Files Changed

| File | Change |
|------|--------|
| `app/api/quests/quiz/route.ts` | Load rubric server-side; ignore client rubric |
| `lib/quests/questLoader.ts` | New `loadQuestDefinitionByQuestId` helper |
| `lib/quests/index.ts` | Re-export new helper |
| `components/quests/QuizRenderer.tsx` | Stop sending rubric/passingScore in POST body |

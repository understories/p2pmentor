# M3 Fix: Server-Side Anti-Gaming Controls

## Problem

All anti-gaming controls for quiz submissions ran on the client:

- **Question shuffle** — `useMemo` in `QuizRenderer.tsx` (cosmetic only)
- **Time gate** — `QuestStepRenderer.tsx` soft UI message (already skipped for quiz steps)
- **No rate limiting** on `POST /api/quests/quiz`

An attacker calling the API directly could brute-force answers with no
server-enforced limits. They could also submit a subset of question IDs
(cherry-picking easy questions) to inflate their percentage score.

## Fix (2026-03-26)

Three server-side controls added to `app/api/quests/quiz/route.ts`:

### 1. IP-based rate limit

- **10 quiz submissions per IP per minute** (vs 60/min for explorer routes).
- Returns `429 Too Many Requests` with `retryAfterMs` when exceeded.
- In-memory store with probabilistic cleanup, same pattern as the explorer
  rate limiter in `lib/explorer/rateLimit.ts`.

### 2. Per-wallet+step cooldown

- **30-second cooldown** between attempts for the same `wallet + stepId`.
- Prevents rapid retry loops that try different answer combinations.
- Returns `429` with human-readable wait message.

### 3. Question completeness validation

- Server compares submitted `questionIds` against the full set from the
  server-loaded rubric.
- If any rubric question is missing from the submission, returns `400`.
- Prevents the cherry-picking attack where submitting 1 of 10 questions
  yields 1/1 = 100%.

## Design Notes

- Rate limit and cooldown stores are in-memory (ephemeral on restart).
  This is acceptable for a beta app; a persistent store (Redis, etc.)
  can be added later if needed.
- The client-side shuffle and time gate remain as UX features; they are
  no longer the only line of defense.

## Files Changed

| File | Change |
|------|--------|
| `app/api/quests/quiz/route.ts` | Added IP rate limit, wallet+step cooldown, question completeness check |

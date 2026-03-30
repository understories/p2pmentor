/**
 * Quiz Time Gate
 *
 * Server-side enforcement of minimum time between quiz start and submission.
 * Prevents automated submissions that skip reading/answering questions.
 *
 * In-memory store (resets on server restart). Acceptable for beta;
 * a persistent store can be added later if needed.
 */

const startTimeStore = new Map<string, number>();

function storeKey(wallet: string, questId: string, stepId: string): string {
  return `${wallet.toLowerCase()}:${questId}:${stepId}`;
}

/**
 * Minimum seconds a user must spend before submitting a quiz.
 * Uses the same formula as the client time gate:
 *   max(durationMinutes * 60 * 0.3, 30)
 *
 * Falls back to 30s if no duration is provided.
 */
export function computeMinSeconds(durationMinutes: number | undefined): number {
  if (!durationMinutes || durationMinutes <= 0) return 30;
  return Math.max(durationMinutes * 60 * 0.3, 30);
}

/**
 * Record when a user starts a quiz.
 */
export function recordQuizStart(
  wallet: string,
  questId: string,
  stepId: string
): { startedAt: number } {
  const key = storeKey(wallet, questId, stepId);
  const now = Date.now();
  startTimeStore.set(key, now);

  // Probabilistic cleanup of old entries (>30 min)
  if (Math.random() < 0.02) {
    const cutoff = now - 30 * 60 * 1000;
    for (const [k, ts] of startTimeStore.entries()) {
      if (ts < cutoff) startTimeStore.delete(k);
    }
  }

  return { startedAt: now };
}

/**
 * Check whether enough time has passed since the quiz was started.
 *
 * Returns { allowed: true } if the time gate is satisfied or if no
 * start time was recorded (graceful: do not block users whose start
 * event was lost to a server restart).
 */
export function checkQuizTimeGate(
  wallet: string,
  questId: string,
  stepId: string,
  minSeconds: number
): { allowed: boolean; elapsedSeconds: number; requiredSeconds: number } {
  const key = storeKey(wallet, questId, stepId);
  const startedAt = startTimeStore.get(key);

  if (!startedAt) {
    return { allowed: true, elapsedSeconds: 0, requiredSeconds: minSeconds };
  }

  const elapsedSeconds = (Date.now() - startedAt) / 1000;
  return {
    allowed: elapsedSeconds >= minSeconds,
    elapsedSeconds: Math.round(elapsedSeconds),
    requiredSeconds: minSeconds,
  };
}

/**
 * Clear a stored start time (e.g. after successful submission).
 */
export function clearQuizStart(wallet: string, questId: string, stepId: string): void {
  const key = storeKey(wallet, questId, stepId);
  startTimeStore.delete(key);
}

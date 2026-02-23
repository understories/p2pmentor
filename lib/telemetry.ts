/**
 * Client-side telemetry helper
 *
 * Fire-and-forget POST to /api/quests/telemetry.
 * Never throws, never blocks UI.
 */

type TelemetryEventType =
  | 'step_completion_error'
  | 'step_view'
  | 'step_drop_off'
  | 'quiz_failure'
  | 'transaction_retry'
  | 'indexer_lag';

export function logClientTelemetry(params: {
  eventType: TelemetryEventType;
  questId: string;
  stepId: string;
  errorType?: string;
  errorMessage?: string;
  retryCount?: number;
  lagMs?: number;
}): void {
  try {
    fetch('/api/quests/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }).catch(() => {});
  } catch {
    // Never throw from telemetry
  }
}

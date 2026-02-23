/**
 * Quest Telemetry API
 *
 * POST: Log a telemetry event (non-blocking, best-effort)
 * GET: Get telemetry events for analysis (admin-only in practice)
 *
 * Week 4 (Feb 22-29) - Reliability pass
 */

import { NextResponse } from 'next/server';
import {
  logTelemetryEvent,
  getTelemetryEvents,
  getDropOffAnalysis,
} from '@/lib/arkiv/questTelemetry';
import { getPrivateKey, ARKIV_PRIVATE_KEY } from '@/lib/config';
import type { TelemetryEventType } from '@/lib/arkiv/questTelemetry';

const VALID_EVENT_TYPES: TelemetryEventType[] = [
  'step_completion_error',
  'step_view',
  'step_drop_off',
  'quiz_failure',
  'transaction_retry',
  'indexer_lag',
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { eventType, questId, stepId, errorType, errorMessage, retryCount, lagMs } = body;

    if (!eventType || !questId || !stepId) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: eventType, questId, stepId' },
        { status: 400 }
      );
    }

    if (!VALID_EVENT_TYPES.includes(eventType)) {
      return NextResponse.json(
        { ok: false, error: `Invalid eventType. Must be one of: ${VALID_EVENT_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    if (!ARKIV_PRIVATE_KEY) {
      return NextResponse.json({ ok: true, logged: false, reason: 'No private key configured' });
    }

    const privateKey = getPrivateKey();

    // Fire-and-forget: don't block the response on telemetry
    logTelemetryEvent({
      eventType,
      questId,
      stepId,
      errorType,
      errorMessage,
      retryCount,
      lagMs,
      privateKey,
    }).catch((err) => {
      console.warn('[POST /api/quests/telemetry] Non-blocking telemetry failed:', err?.message);
    });

    return NextResponse.json({ ok: true, logged: true });
  } catch (error: any) {
    console.error('[POST /api/quests/telemetry] Error:', error);
    return NextResponse.json({ ok: true, logged: false, reason: error.message });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const questId = searchParams.get('questId');
    const stepId = searchParams.get('stepId');
    const eventType = searchParams.get('eventType') as TelemetryEventType | null;
    const analysis = searchParams.get('analysis');

    if (analysis === 'dropoff' && questId) {
      const dropOff = await getDropOffAnalysis({ questId });
      return NextResponse.json({ ok: true, dropOff });
    }

    const events = await getTelemetryEvents({
      eventType: eventType || undefined,
      questId: questId || undefined,
      stepId: stepId || undefined,
    });

    return NextResponse.json({ ok: true, events });
  } catch (error: any) {
    console.error('[GET /api/quests/telemetry] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to get telemetry events' },
      { status: 500 }
    );
  }
}

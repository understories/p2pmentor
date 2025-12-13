# Feedback Modules

## App feedback

Location: `lib/arkiv/appFeedback.ts`

`app_feedback` entities for general UX feedback. Admin responses stored as `admin_response` entities.

## Session feedback

Location: `lib/arkiv/feedback.ts`

`session_feedback` entities keyed by session. Structured feedback on mentorship sessions.

## DX metrics

Location: `lib/arkiv/dxMetrics.ts`

Developer experience metrics stored on Arkiv. Tracks pain points, errors, and improvements.

## Performance tracking

Location: `lib/arkiv/perfSnapshots.ts`

Performance metrics stored as `dx_metric` entities on Arkiv. Performance snapshots stored as `perf_snapshot` entities. All data verifiable on-chain via transaction hashes.

## Constraints

Respect data ownership and consent. All feedback stored on Arkiv, no opaque off-chain logging.

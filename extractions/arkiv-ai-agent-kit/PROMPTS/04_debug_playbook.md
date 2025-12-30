# 40_debug_playbook.md — Systematic Debug Playbook (Public-safe)

When something "doesn't work," do not guess. Run a structured audit.

## 1) Establish ground truth
- What spaceId is being used?
- What wallet(s) are involved (normalized lowercase)?
- What entity type is being queried/written?
- Do we have a txHash?

## 2) Classify the failure
- Write never submitted (validation/config)
- Write submitted but not indexed yet (indexer lag)
- Query shape wrong (missing type/spaceId/limit)
- Wallet casing mismatch
- Stable key mismatch (derived key differs)
- Rate limiting / nonce replacement

## 3) Instrumentation checklist
- Log spaceId + type + subject_wallet + derived entity_key
- Log txHash and return it to client
- Log query filters and limit
- Add a temporary "debug panel" in UI showing these values (public-safe)

## 4) Reproduce minimally
- Add or update one smoke test or seed script
- Keep repro deterministic; avoid timing assumptions where possible

## 5) Fix policy-level issues, not just symptoms
- If you relied on read-your-writes, add reconciliation.
- If you query-first upserted mutable state, switch to stable keys.
- If you stuffed queryable fields into payload, move them to attributes.


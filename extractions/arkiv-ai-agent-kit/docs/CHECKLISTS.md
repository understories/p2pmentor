# CHECKLISTS.md — PR + Review Checklists (Public)

## Pre-commit checklist (must pass)
- [ ] `npm run build`
- [ ] `npm run typecheck`
- [ ] `git diff --check` is clean
- [ ] No tracked files under `refs/`
- [ ] No secrets in code/docs/scripts (no fallback secrets)

## PR checklist
- [ ] Smallest reasonable diff
- [ ] No whitespace-only changes
- [ ] Docs are in `docs/` and are public-safe
- [ ] Arkiv writes use timeout wrapper
- [ ] Queries include type + spaceId + limit
- [ ] Wallets normalized to lowercase in writes and queries
- [ ] Mutable state uses stable keys (no query-first upsert)
- [ ] Indexer lag handled as a state (reconciliation present)

## Anti-patterns (explicit)
- ❌ Query-first upsert for mutable state
- ❌ Assuming immediate read-your-writes
- ❌ Treating indexer lag as exceptional error
- ❌ Querying without type/spaceId/limit
- ❌ Wallet casing inconsistencies
- ❌ Putting queryable fields only in payload


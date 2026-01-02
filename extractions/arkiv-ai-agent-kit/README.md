# Arkiv AI Agent Kit

**Purpose:** Drop-in LLM context for building Arkiv integrations correctly from day one.

This repo is designed to be dropped into an AI coding tool's context (Cursor/Copilot/Claude/etc.) so it can build Arkiv-native applications without "centralized DB brain."

## What's Included

- **`AGENTS.md`** - Operating manual for AI agents working with Arkiv
- **`PROMPTS/`** - Seven prompt files covering repo rules, entity patterns, query shapes, timeouts, debugging, and seed scripts
- **`docs/ENGINEERING_GUIDELINES.md`** - Public-safe version of Engineering Guidelines
- **`docs/CHECKLISTS.md`** - PR and review checklists with anti-patterns
- **`scripts/precommit-check.sh`** - Precommit validation (build, typecheck, refs/, secrets, whitespace)
- **`scripts/derive-signer-address.mjs`** - Manual helper to derive signer address from `ARKIV_PRIVATE_KEY`
- **`.github/workflows/ci.yml`** - CI workflow enforcing all Engineering Guidelines

## Quick Start

1. **Copy this repo into your LLM's context** (or reference the files)
2. **Provide your goal:** "Build an Arkiv app that does X"
3. **Reference the prompts:** Point the agent to `PROMPTS/*.md` files
4. **Require compliance:** Agent must follow Engineering Guidelines (enforced via CI)

## Key Principles

- **Testnet-native:** Everything targets Mendoza testnet (for now)
- **Indexer lag is normal:** Represent it as a state, not an error
- **Immutable history:** Design state as interpretation over append-only facts
- **Wallet normalization everywhere:** Always lowercase in writes and queries
- **Query shape standardization:** Every query includes `type` + `spaceId` + `limit`

## Anti-Patterns (Explicit)

- ❌ Query-first upsert for mutable state
- ❌ Assuming immediate read-your-writes
- ❌ Treating indexer lag as exceptional error
- ❌ Querying without type/spaceId/limit
- ❌ Wallet casing inconsistencies
- ❌ Putting queryable fields only in payload

## Recommended Invocation Pattern

For maximum leverage, use this single invocation pattern with your AI coding tool:

```
Read and apply the following Arkiv integration guidelines:

1. Read AGENTS.md (operating manual for Arkiv + repo rules)
2. Apply these prompts in order:
   - PROMPTS/00_repo_rules.md (build, secrets, refs/, whitespace)
   - PROMPTS/10_arkiv_entity_patterns.md (wallet normalization, stable keys, timeouts)
   - PROMPTS/20_query_shapes.md (type+spaceId+limit, defensive reading)
   - PROMPTS/30_timeouts_and_retries.md (submitted vs indexed, reconciliation)
3. Do not touch refs/ (internal-only, never committed)
4. Run precommit script mentally: ensure build would pass, no secrets, no refs/, clean whitespace

When implementing:
- Use smallest number of files possible
- Include smoke test or minimal repro path
- Follow Arkiv-native patterns (immutable history, indexer lag is normal)
- Never assume immediate read-your-writes
```

This pattern ensures the agent follows all Engineering Guidelines and Arkiv best practices automatically.

## When NOT to Use Arkiv

Arkiv is not suitable for all use cases. Use this section to prevent agent hallucination:

**Arkiv cannot do:**
- **OR queries across spaceId** - Arkiv doesn't support OR in queries. Strategy: Query broadly by `type`, then filter client-side by allowed spaceIds.
- **Instant read-your-writes** - Indexer lag is normal. "Submitted" ≠ "Indexed". Always implement reconciliation.
- **Mutable state without stable keys** - Use Pattern B (stable entity keys) for mutable state. Avoid "query first, then decide create" for mutable entities.
- **Large payloads** - Keep payloads reasonable (prefer attributes for queryable data).
- **Real-time subscriptions** - Arkiv is eventually consistent. Poll for updates if needed.

**When to use centralized DB instead:**
- Real-time collaborative editing
- High-frequency writes (thousands per second)
- Complex relational queries with joins
- Immediate consistency requirements

If your use case requires these, consider a hybrid approach or a different stack.

## Usage with AI Tools

When asking an agent to implement Arkiv functionality:

1. Use the [Recommended Invocation Pattern](#recommended-invocation-pattern) above
2. Provide entity types + attribute schema (or say "use defaults from app-kit primitives")
3. Require the agent to:
   - Add/modify the smallest number of files possible
   - Include a smoke test or minimal repro path
   - Run the precommit checklist logically

## CI Enforcement

All changes must pass:
- `npm run build`
- `npm run typecheck`
- `git diff --check` (no whitespace-only changes)
- No `refs/` files tracked
- No secrets in code/docs
- Public docs must be public-safe

## Testnet Ops

- Server signer wallet must be funded (or writes will fail/timeout)
- Derive signer address: `ARKIV_PRIVATE_KEY=0x... node scripts/derive-signer-address.mjs`
- CI uses local mode for determinism; humans can use Mendoza for ecosystem validation

## Related

- **Arkiv App Kit** (`@understories/arkiv-app-kit`) - Shared core package used by templates
- **Arkiv Patterns Catalog** - Full pattern documentation
- **Engineering Guidelines** - Complete guidelines (this repo includes public-safe version)

---

**Status:** Testnet-native (Mendoza)  
**Last Updated:** 2025-12-30


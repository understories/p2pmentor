# Arkiv AI Agent Kit

**Purpose:** Drop-in LLM context for building Arkiv integrations correctly from day one.

This repo is designed to be dropped into an AI coding tool's context (Cursor/Copilot/Claude/etc.) so it can build Arkiv-native applications without "centralized DB brain."

## What's Included

- **`AGENTS.md`** - Operating manual for AI agents working with Arkiv
- **`PROMPTS/`** - Six prompt files covering repo rules, entity patterns, query shapes, timeouts, and debugging
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

## Usage with AI Tools

When asking an agent to implement Arkiv functionality:

1. Paste `AGENTS.md` and relevant `PROMPTS/*.md` files into context
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

- **Arkiv App Primitives** (`@understories/arkiv-app-kit`) - Shared core package used by templates
- **Arkiv Patterns Catalog** - Full pattern documentation
- **Engineering Guidelines** - Complete guidelines (this repo includes public-safe version)

---

**Status:** Testnet-native (Mendoza)  
**Last Updated:** 2025-12-30


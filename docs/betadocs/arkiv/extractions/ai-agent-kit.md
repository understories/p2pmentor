# Arkiv AI Agent Kit

**Purpose:** Drop-in LLM context for building Arkiv integrations correctly from day one.

**Status:** Available in `extractions/arkiv-ai-agent-kit/` (will be published as standalone repo)

**Target Audience:** Developers using AI coding tools (Cursor, Copilot, Claude, etc.) to build Arkiv applications.

---

## What This Kit Does

The Arkiv AI Agent Kit is a collection of prompts, scripts, and documentation designed to be dropped into an AI coding tool's context. It enables LLMs to build Arkiv-native applications without falling into "centralized database" patterns.

**Key Capabilities:**

1. **Enforces Engineering Guidelines** via CI and precommit scripts
2. **Provides LLM-readable prompts** covering all essential Arkiv patterns
3. **Prevents common mistakes** through explicit anti-pattern callouts
4. **Testnet-native** (Mendoza-focused) with clear operational guidance

**What It Is Not:**

- Not a code library or framework
- Not a replacement for the Arkiv SDK
- Not a tutorial (complements learn-arkiv, doesn't replace it)
- Not opinionated about app architecture (only enforces Arkiv-native invariants)

---

## Repository Structure

When published as a standalone GitHub repo, the structure will be:

```
arkiv-ai-agent-kit/
├── AGENTS.md                     # Operating manual for AI agents
├── PROMPTS/                      # Six prompt files for LLM context
│   ├── 00_repo_rules.md          # Build, secrets, refs/, whitespace rules
│   ├── 05_docs_separation.md     # Public vs internal docs
│   ├── 10_arkiv_entity_patterns.md # Entity patterns, wallet normalization, stable keys
│   ├── 20_query_shapes.md        # Query structure, defensive reading
│   ├── 30_timeouts_and_retries.md # Transaction timeouts, reconciliation
│   └── 40_debug_playbook.md      # Systematic debugging approach
├── docs/
│   ├── ENGINEERING_GUIDELINES.md # Public-safe version of guidelines
│   └── CHECKLISTS.md             # PR checklists with anti-patterns
├── scripts/
│   ├── precommit-check.sh        # Precommit validation (copy-pastable)
│   └── derive-signer-address.mjs # Manual signer address helper
├── .github/workflows/
│   └── ci.yml                    # CI enforcing all guidelines
└── README.md                     # Usage instructions and overview
```

---

## README Content (When Published)

The README will include:

### Quick Start

1. Copy this repo into your LLM's context (or reference the files)
2. Provide your goal: "Build an Arkiv app that does X"
3. Reference the prompts: Point the agent to `PROMPTS/*.md` files
4. Require compliance: Agent must follow Engineering Guidelines (enforced via CI)

### What's Included

- **AGENTS.md** - Operating manual for AI agents working with Arkiv
- **PROMPTS/** - Six prompt files covering repo rules, entity patterns, query shapes, timeouts, and debugging
- **docs/ENGINEERING_GUIDELINES.md** - Public-safe version of Engineering Guidelines
- **docs/CHECKLISTS.md** - PR and review checklists with anti-patterns
- **scripts/precommit-check.sh** - Precommit validation (build, typecheck, refs/, secrets, whitespace)
- **scripts/derive-signer-address.mjs** - Manual helper to derive signer address from `ARKIV_PRIVATE_KEY`
- **.github/workflows/ci.yml** - CI workflow enforcing all Engineering Guidelines

### Key Principles

- **Testnet-native:** Everything targets Mendoza testnet (for now)
- **Indexer lag is normal:** Represent it as a state, not an error
- **Immutable history:** Design state as interpretation over append-only facts
- **Wallet normalization everywhere:** Always lowercase in writes and queries
- **Query shape standardization:** Every query includes `type` + `spaceId` + `limit`

### Anti-Patterns (Explicit)

- Query-first upsert for mutable state
- Assuming immediate read-your-writes
- Treating indexer lag as exceptional error
- Querying without type/spaceId/limit
- Wallet casing inconsistencies
- Putting queryable fields only in payload

### Usage with AI Tools

When asking an agent to implement Arkiv functionality:

1. Paste `AGENTS.md` and relevant `PROMPTS/*.md` files into context
2. Provide entity types + attribute schema (or say "use defaults from app-kit primitives")
3. Require the agent to:
   - Add/modify the smallest number of files possible
   - Include a smoke test or minimal repro path
   - Run the precommit checklist logically

### CI Enforcement

All changes must pass:
- `npm run build`
- `npm run typecheck`
- `git diff --check` (no whitespace-only changes)
- No `refs/` files tracked
- No secrets in code/docs
- Public docs must be public-safe

### Testnet Ops

- Server signer wallet must be funded (or writes will fail/timeout)
- Derive signer address: `ARKIV_PRIVATE_KEY=0x... node scripts/derive-signer-address.mjs`
- CI uses local mode for determinism; humans can use Mendoza for ecosystem validation

### Related

- **Arkiv App Primitives** (`@understories/arkiv-app-kit`) - Shared core package used by templates
- **Arkiv Patterns Catalog** - Full pattern documentation
- **Engineering Guidelines** - Complete guidelines (this repo includes public-safe version)

---

## How It Works

### For Human Developers

1. **Copy the kit** into your project or reference it
2. **Use the prompts** when working with AI tools
3. **Copy the scripts** (precommit-check.sh, CI workflow) into your repo
4. **Follow the checklists** in `docs/CHECKLISTS.md` before committing

### For AI Agents

1. **Load context:** Agent receives `AGENTS.md` + relevant `PROMPTS/*.md` files
2. **Understand constraints:** Agent learns Arkiv invariants (wallet normalization, query shapes, timeouts)
3. **Generate code:** Agent produces code that follows patterns automatically
4. **Validate:** Precommit checks ensure compliance before commit

### Enforcement Mechanism

The kit converts "good intentions" into "the repo won't accept bad changes" via:

- **CI checks:** Build, typecheck, refs/ tracking, secret scanning
- **Precommit hooks:** Run checks before commit (optional but recommended)
- **Code patterns:** Helper functions enforce invariants (wallet normalization, spaceId, etc.)

---

## Why This Matters

**Problem:** Most developers (and AI tools) think in "centralized database" patterns:
- Immediate read-your-writes
- Query-first upserts
- Treating indexer lag as a bug
- Wallet casing inconsistencies

**Solution:** This kit teaches the correct Arkiv-native patterns upfront, preventing entire classes of bugs.

**Impact:** Multiplies the number of competent Arkiv integrators quickly. One developer using this kit correctly can scaffold multiple Arkiv apps with AI assistance.

---

## Testnet-Native Design

Everything in this kit assumes **Mendoza testnet**:

- All examples use testnet addresses
- Scripts support `ARKIV_TARGET=local` (CI) or `ARKIV_TARGET=mendoza` (humans)
- README includes "Testnet Ops Reality" section
- Mainnet guidance is intentionally non-operational (checklist, not instructions)

This ensures builders validate the protocol at scale before mainnet.

---

## Integration with Templates

This kit is used by all Arkiv templates:

1. **Template 1 (Next.js Starter)** - Built using AI kit
2. **Template 2 (Capability Grants)** - Uses AI kit prompts
3. **Template 4 (Notifications)** - Validates kit works for complex patterns

Each template demonstrates that the kit works for different use cases.

---

## Future Enhancements

- **Repo templates:** Barebones Next.js skeleton wired to app-kit
- **More prompt files:** Additional patterns as they emerge
- **Integration examples:** Show kit in action with real code

---

**Last Updated:** 2025-12-30  
**Status:** Complete and ready for publication


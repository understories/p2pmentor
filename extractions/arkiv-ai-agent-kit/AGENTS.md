# AGENTS.md — Arkiv AI Agent Operating Manual (Testnet-Native)

This repo is designed to be dropped into an LLM's context so it can build Arkiv integrations without "centralized DB brain."
Everything targets Mendoza testnet for now.

## 0) Non-negotiables (these are CI-enforced)
- Build must pass before any commit/PR.
- Never commit secrets (no keys/tokens/passwords, no "cute fallbacks" like `|| "password"`).
- Never commit anything under `refs/` (ever).
- No whitespace-only diffs (`git diff --check` must be clean).

## 1) How to use this with an AI coding tool
When asking an agent to implement anything:
1) Paste these files into context (or reference them):
   - `PROMPTS/00_repo_rules.md`
   - `PROMPTS/05_docs_separation.md`
   - `PROMPTS/10_arkiv_entity_patterns.md`
   - `PROMPTS/20_query_shapes.md`
   - `PROMPTS/30_timeouts_and_retries.md`
   - `PROMPTS/40_debug_playbook.md`
2) Provide the repo's goal in one sentence.
3) Provide the entity types + attribute schema you want (or say "use defaults from app-kit primitives").
4) Require the agent to:
   - add/modify the smallest number of files possible
   - include a smoke test or a minimal repro path
   - run the precommit checklist logically (even if it can't execute commands)

## 2) Arkiv mental model (the minimum you must internalize)
- Arkiv data is immutable history. "Updates" are new transactions; "current state" is derived by interpretation.
- Indexers are eventually consistent. "Submitted" ≠ "Indexed." Your UX must represent this truth.
- Queryability lives in attributes. Payload is for richer content.
- Wallet casing issues will bite you unless you normalize everywhere.

## 3) Canonical invariants (must hold in every template)
- Wallet addresses normalized to lowercase in *writes and queries*.
- Every query includes: `type` + `spaceId` + `limit`.
- All writes go through a timeout wrapper; the API must return "submitted/pending" states gracefully.
- Prefer stable entity keys for mutable state (Pattern B). Avoid "query-first then decide create" for mutable entities.
- Prefer companion `*_txhash` entities for observability + reliable lookup.

## 4) Testnet ops reality (Mendoza)
- Server signer wallet must be funded (or writes will fail / time out).
- Derive signer address from `ARKIV_PRIVATE_KEY` using `scripts/derive-signer-address.mjs`.
- CI should use local mode for determinism; humans can use Mendoza for ecosystem validation.

## 5) Output standards for agents
When producing code:
- Use TypeScript strict typing.
- Add comments that explain WHY (not WHAT), especially around timeouts/indexer lag/stable keys.
- Keep abstractions restrained: prefer small helpers + explicit usage.
- Do not introduce new dependencies unless essential.

## 6) If the agent is unsure
The correct response is NOT to guess.
Use `PROMPTS/40_debug_playbook.md` to propose a systematic audit plan and add instrumentation.


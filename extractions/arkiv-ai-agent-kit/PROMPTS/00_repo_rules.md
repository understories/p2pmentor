# 00_repo_rules.md — Repo-level Rules (CI-enforced)

You are modifying a FLOSS repo. Your changes must be minimal, buildable, and safe.

## Hard rules (do not violate)
1) BUILD MUST PASS
- Must ensure `npm run build` succeeds.
- Must ensure `npm run typecheck` succeeds.

2) NEVER COMMIT SECRETS
- No private keys, API keys, tokens, passwords, or seed phrases.
- No fallback secrets like: `process.env.X || "secret"`.
- Scripts must fail closed if required env vars are missing.

3) NEVER COMMIT `refs/`
- `refs/` is internal-only. It must never be tracked by git.
- Do not bypass `.gitignore` with `git add -f`.
- If you need public docs, put them in `docs/`.

4) NO WHITESPACE-ONLY DIFFS
- `git diff --check` must be clean.
- Do not change formatting unless required by the change.

## When you propose a change, you must also provide:
- What files changed and why
- How to validate the change (commands or a manual smoke path)
- Failure modes you considered


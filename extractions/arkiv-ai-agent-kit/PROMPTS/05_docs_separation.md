# 05_docs_separation.md — Public Docs vs Internal Procedures

You must maintain strict separation:

## Public (`docs/`) may include:
- User-facing guides
- Architecture explanations
- API usage
- Pattern explanations
- Non-sensitive troubleshooting

## Internal (`refs/`) must include:
- Anything mentioning passwords/keys/tokens
- Internal testing procedures or incident reports
- Team planning notes
- Operational runbooks with privileged steps

## Rules
- Never add internal procedures to `docs/`.
- Never add `refs/` content to git.
- If you are uncertain whether something is sensitive, treat it as internal and do NOT commit it.

## Anti-patterns
- "Here's the private key you can use on testnet…" ❌
- "Run this internal load test script…" ❌
- "Here's our internal signer rotation process…" ❌

## Allowed phrasing in public docs
- "Set `ARKIV_PRIVATE_KEY` in your environment; scripts will fail if missing." ✅
- "Fund the derived signer address via a faucet (manual)." ✅
- "CI uses local mode for determinism; Mendoza is for humans." ✅


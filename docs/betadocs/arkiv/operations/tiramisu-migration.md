# Tiramisu Migration

**Date:** 2026-10-27
**Status:** Complete

Migration from Braga to Tiramisu — Arkiv's current public testnet.

---

## What Changed

| Setting          | Braga (old)                                  | Tiramisu (new)                                        |
| ---------------- | -------------------------------------------- | ----------------------------------------------------- |
| Chain export     | `braga` from SDK                             | `tiramisu` from SDK                                   |
| Chain ID         | `60138453102`                                | `7738577`                                             |
| HTTP RPC         | `https://braga.hoodi.arkiv.network/rpc`      | `https://rpc.tiramisu.db-chain.testnet.arkiv.network` |
| WebSocket        | `wss://braga.hoodi.arkiv.network/rpc/ws`     | `wss://rpc.tiramisu.db-chain.testnet.arkiv.network`   |
| Explorer         | `https://explorer.braga.hoodi.arkiv.network` | `https://tiramisu.explorer.arkiv.network`             |
| Entity Explorer  | (inline in explorer)                         | `https://data.arkiv.network`                          |
| Faucet           | `https://braga.hoodi.arkiv.network/faucet/`  | `https://hub.arkiv.network/faucet`                    |
| Native gas token | GLM                                          | GLM (unchanged)                                       |
| Minimum SDK      | `0.6.5`                                      | `0.8.0`                                               |

---

## Files Changed

### p2pmentor

**Code:**

- `lib/arkiv/client.ts` — import `tiramisu`, pass to all three client factories
- `lib/arkiv/explorer.ts` — `ARKIV_EXPLORER_BASE_URL` updated
- `lib/arkiv/assessmentResult.ts` — verification URL strings updated
- `lib/arkiv/perfSnapshots.ts` — comment updated
- `lib/auth/metamask.ts` — `switchToBragaChain` → `switchToTiramisuChain`, all chain references
- `lib/auth/walletconnect.ts` — all chain references
- `lib/wallet/getWalletClient.ts` — import and chain reference
- `lib/wallet/getWalletClientFromPasskey.ts` — fallback chain name in log
- `extractions/arkiv-app-kit/src/client.ts` — all chain references, RPC default URL
- `extractions/arkiv-app-kit/src/env.ts` — `ArkivTarget` type (`'braga'` → `'tiramisu'`), `isBragaTarget` → `isTiramisuTarget`, default value
- `package.json` — `@arkiv-network/sdk` `0.6.7` → `0.8.1`

**SDK 0.8.0 breaking changes (vs 0.6.x):**

- `@arkiv-network/sdk/accounts` subpath removed → use `viem/accounts` for `privateKeyToAccount`
- `http` and `custom` transports no longer re-exported from `@arkiv-network/sdk` → use `viem` directly

**Tests:**

- `__tests__/lib/arkiv/network-config.test.ts` — chain ID, name, and explorer URL assertions

**Docs:** all files under `docs/`, `README.md`, `SECURITY_AUDIT.md`, `content/`, `extractions/` updated.

### arkiv-hello-world (serverlessdapp101)

- `lib/arkiv/client.ts` — `braga` → `tiramisu`
- `lib/config.ts` — comment updated
- `app/hello-world/page.tsx` — network copy
- `app/api/serverless-dapp101/messages/route.ts` — comment
- `scripts/generate-wallet.mjs` — faucet URL
- `.env.example` — faucet URL comment
- `README.md` — full network table, history, migration checklist, links
- `package.json` — SDK `^0.6.8` → `^0.8.1`

---

## Post-Migration Checklist

- [ ] `pnpm install` in p2pmentor to pull SDK 0.8.1
- [ ] `npm install` in arkiv-hello-world to pull SDK 0.8.1
- [ ] Get fresh GLM on Tiramisu faucet: https://hub.arkiv.network/faucet (balances do not port)
- [ ] Update `ARKIV_PRIVATE_KEY` in Vercel if rotating the signing wallet
- [ ] Run `pnpm test:unit` in p2pmentor — network-config tests should pass against Tiramisu
- [ ] Smoke-test `/auth` → connect MetaMask → confirm MetaMask prompts to add "Tiramisu" chain
- [ ] Smoke-test entity write + verify link opens `https://tiramisu.explorer.arkiv.network`

---

## Historical context

See [braga-migration.md](braga-migration.md) for the previous Kaolin → Braga migration notes.

Testnet history: Mendoza → Kaolin → Braga → **Tiramisu** (current)

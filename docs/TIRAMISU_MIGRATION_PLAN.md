# Plan: Braga → Tiramisu Migration (SDK 0.6.7 → 0.8.x)

Status: **DRAFT for review**. No code has changed yet.
Goal: get production working again on the current Arkiv testnet with the **smallest safe diff**. Modernizing the code comes later, as a separate follow-up.

---

## 1. What changed upstream

| Item | Today (Braga, SDK 0.6.7) | Current (Tiramisu, SDK 0.8.1) |
| --- | --- | --- |
| Chain export | `braga` | `tiramisu` (`braga` and `kaolin` were removed from `@arkiv-network/sdk/chains`) |
| Chain id | 60138453102 | **7738577** |
| RPC | `https://braga.hoodi.arkiv.network/rpc` | `https://rpc.tiramisu.db-chain.testnet.arkiv.network` (wss on the same host) |
| Explorer | `https://explorer.braga.hoodi.arkiv.network` | `https://tiramisu.explorer.arkiv.network` (not confirmed; see §6). **The SDK chain object has no `blockExplorers` entry.** |
| Faucet | `braga.hoodi.arkiv.network/faucet` | `https://hub.arkiv.network/faucet` (needs a wallet sign-in) |
| Native currency | GLM | GLM |
| Arkiv system address | `0x…61726b6976` | `0x4400000000000000000000000000000000000044` |

**Why prod is down:** Braga is no longer the supported network, and SDK 0.6.7 cannot talk to Tiramisu. The JSON-RPC schema (`arkiv_query`, the entity shape, the attribute encoding) and the system address both changed. This means **a chain-config swap alone will not work**; we have to move to SDK 0.8.x.

### Breaking SDK API changes that affect this repo

I diffed the published 0.6.7 and 0.8.1 packages.

| 0.6.7 API we use | 0.8.x replacement | Usage in this repo |
| --- | --- | --- |
| `client.buildQuery().where(eq()).withAttributes().withPayload().limit().fetch()` | `client.select({ attributes: true, payload: true }).where(eq()).limit().fetch()` | about 178 call sites, 58 files |
| `attributes: [{ key, value }]` on write | `attributes: { name: value }` (typed values: `str`, `i32`, `u64`, `dec`, …) | about 125 sites, 49 files |
| `entity.attributes` read as `[{ key, value }]` (`.find(a => a.key === …)`) | `Record<string, { type, value }>` | about 165 lookups, 56 files |
| `expiresIn: <seconds>` | `expires: ExpirationTime.fromSeconds(n)` (or `fromDays`, `permanent()`, …) | 98 sites, 42 files |
| `updateEntity({ entityKey, payload, attributes, expiresIn })` (full replace) | `patchEntity({ entityKey, payload, set, unset })`; expiry is separate via `extendEntity` | 8 sites, 5 files, plus `entity-utils.ts` |
| `privateKeyToAccount` from `@arkiv-network/sdk/accounts` | `viem/accounts` (the subpath was removed) | 6 sites |
| `http`, `custom` re-exported from the SDK root | import from `viem` (now a **peer dependency**) | 4 files |
| `.limit(n)` with no cap | **max 200** per page; `fetch()` throws above that | `.limit(1000)` ×10, `.limit(500)` ×3, `.limit(5000)` ×1 |
| `eq(key, string \| number)` | `eq(name, ValueInput)`; a bare `number` becomes `i32` and must match the stored type | 480 sites; all string values today |

### New protocol limits that our data hits

These are enforced client-side, so `createEntity` throws.

- **String attribute values: max 128 bytes.** Free-text attributes will go over this: `bio` (profile.ts), `description` and `title` (learnerQuest.ts, languageQuest.ts), `reason` (revocation.ts, reviewModeGrant.ts), `videoJoinUrl`, `issueUrl`, `meta_learning_json`.
- **Max 32 attributes per entity.** Profiles add one `skill_${idx}` attribute per skill, so a large skill list can exceed this.
- Attribute names: at most 32 chars, `^[A-Za-z][A-Za-z0-9._-]*$`, with reserved words (`key`, `str`, `and`, …) not allowed. **All 173 names in use pass this.**
- Payload: max 128 KiB.
- Integers over 2^31 must be typed `u64`. Today every attribute value is a string, so this is a non-issue for the minimal path.

### Data

Tiramisu is a **fresh chain**, so none of the Braga entities exist there. That covers profiles, skills, quests, beta codes, sessions and notifications. After the deploy, prod is **empty** until we reseed. Users will need to re-onboard unless we run a one-off export and import (see §4, step 7).

---

## 2. Strategy: a compatibility adapter, not a 60-file rewrite

About 1,000 call sites depend on the 0.6.7 query, attribute and expiry shapes. Rewriting all of them is the "state of the art" end state, but it is a large, risky diff for an outage fix.

**Minimal path:** upgrade the SDK and put a thin **compat layer** inside `lib/arkiv/client.ts`. The three factory functions that every module already uses (`getPublicClient`, `getWalletClientFromPrivateKey`, `getWalletClientFromMetaMask`) return clients that keep the 0.6.7 surface this app uses, implemented on top of 0.8.x. **Callers do not change.**

`lib/arkiv/compat.ts` (new, about 200 lines plus tests):

1. **`buildQuery()` shim.** It returns a builder with `where`, `withAttributes`, `withPayload`, `limit`, `fetch` (plus `ownedBy` and `orderBy` as no-ops). The builder maps to `select({ key: true, owner: true, attributes, payload, contentType, expiresAt, createdAt })`.
   - `limit > 200` is handled by paging with the cursor until the requested count.
   - `fetch()` returns `{ entities }`. Each entity has `attributes` converted back to `[{ key, value }]`, with the value as `String(v.value)`. `payload` stays a `Uint8Array`.
2. **`createEntity({ payload, contentType, attributes: [], expiresIn })`**
   - Converts the attribute array to an object of `str()` values, with an explicit typed passthrough if a value is already tagged.
   - Converts `expiresIn` to `ExpirationTime.fromSeconds(expiresIn)`.
   - **Over-length string values (more than 128 bytes) are truncated** to a UTF-8-safe 128 bytes, with a `console.warn`. The full text already lives in the JSON payload, so attribute copies are only used for filtering and display fallbacks. This needs confirming per entity in review.
   - **More than 32 attributes:** keep the first 32 (`type`, `wallet` and `spaceId` are always first) and warn.
3. **`updateEntity({ entityKey, payload, contentType, attributes, expiresIn })`.** Keeps the old full-replace semantics: `getEntity` for the current attribute names, then `patchEntity({ set: newAttrs, unset: oldNames − newNames, payload, contentType })`. If `expiresIn` is given, follow with `extendEntity`. Same limits handling as `createEntity`.
4. **`getEntity` shim.** Returns the same legacy entity shape as `fetch()`.

`eq` from `@arkiv-network/sdk/query` keeps working unchanged, because we only pass strings and the shim writes every attribute as `str`. The `and` import in `notificationPreferences.ts` is unused and also still exists.

---

## 3. Minimal code changes (the PR diff)

| # | File(s) | Change |
| --- | --- | --- |
| 1 | `package.json`, `pnpm-lock.yaml` | `@arkiv-network/sdk` `0.6.7` → `0.8.1` (pinned). Pin `viem` to a version that satisfies the SDK's peer range. |
| 2 | **new** `lib/arkiv/chain.ts` | `export const arkivChain = { ...tiramisu, blockExplorers: { default: { name: 'Arkiv Explorer', url: ARKIV_EXPLORER_BASE_URL } } }`. The wallet add-chain code reads `.blockExplorers.default.url`, which is `undefined` on the SDK's `tiramisu` object. This becomes the one source of truth for the chain. |
| 3 | `lib/arkiv/client.ts` | Import `http` and `custom` from `viem`, `privateKeyToAccount` from `viem/accounts`, and use `arkivChain`. Wrap the clients with the compat layer. |
| 4 | **new** `lib/arkiv/compat.ts` + `__tests__/lib/arkiv/compat.test.ts` | The adapter from §2, with unit tests for attribute conversion, truncation, the expiry mapping, limit paging and the update→patch diff. |
| 5 | `lib/auth/metamask.ts`, `lib/auth/walletconnect.ts`, `lib/wallet/getWalletClient.ts`, `app/auth/page.tsx` | Replace `braga` with `arkivChain`. Wallets built here use `createWalletClient` directly, so wrap them with the same compat helper. Also fix the `'braga'` fallback label in `getWalletClientFromPasskey.ts`. |
| 6 | `lib/config.ts`, `lib/arkiv/signer-metadata.ts`, `lib/arkiv/betaAccess.ts`, `lib/arkiv/reviewModeGrant.ts` | Change the `privateKeyToAccount` import from `@arkiv-network/sdk/accounts` to `viem/accounts`. |
| 7 | `lib/arkiv/explorer.ts` | Set `ARKIV_EXPLORER_BASE_URL` to the Tiramisu explorer and verify its URL paths (`/tx/…`, `/entity/…`). |
| 8 | about 35 files with inline `https://explorer.braga.hoodi.arkiv.network` | Replace each inline URL with the `ARKIV_EXPLORER_BASE_URL` / `getArkivExplorer*Url` helpers. A mechanical `sed` covers it, and the next network change becomes a one-line edit. |
| 9 | `__tests__/lib/arkiv/network-config.test.ts` | Expect chain id `7738577`, the Tiramisu explorer and GLM. |
| 10 | `app/auth/page.tsx:997`, `components/network/IntegrationGuide.tsx`, `content/quests/arkiv/steps/06,11`, `components/BetaBanner.tsx` and the other copy in the Braga commit `791c91b` | Update user-facing network name, faucet and explorer copy. |

**Out of scope for the outage PR.** These are flagged, and none of them blocks prod:

- `scripts/*` (dev-only). They use `getWalletClientFromPrivateKey`, so most work through the shim automatically. The few that construct clients directly (`verify-sdk-update-api.ts`, `test-jitsi-direct.ts`) get a follow-up.
- `extractions/*` (separate packages on SDK `^0.1.0`).
- `app/admin/m1-exam/page.tsx` display strings. These are code samples shown in the UI, not executed; refresh them with the docs.
- `subgraph/`. It is feature-flagged (`USE_SUBGRAPH_FOR_NETWORK`), and its manifest indexes the old system address and event signatures, so it needs a rewrite against the new `ENTITY_EVENTS_ABI`. **Keep the flag off.**

---

## 4. Rollout steps

1. Implement steps 1–10 on `claude/arkiv-docs-testnet-update-b1ro43`. Run `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
2. **Smoke-test against live Tiramisu** with a funded throwaway key:
   - Create a profile with a bio longer than 128 bytes.
   - Run the query, update, and `limit(1000)` paging paths.
   - Check that explorer links resolve.
   - Do the MetaMask add-chain flow.
   - Do the passkey and WalletConnect sign-in flows.
3. **Fund the prod signer.** Get GLM for the `ARKIV_PRIVATE_KEY` address (the server-side signer) from `hub.arkiv.network/faucet`. Note that the faucet requires a wallet sign-in.
4. No Vercel env var changes are needed for the chain. RPC and chain come from the SDK; `BETA_SPACE_ID` and `ARKIV_PRIVATE_KEY` stay the same.
5. Deploy a preview on Vercel and run Playwright e2e against it.
6. Promote to prod.
7. **Reseed:** run `seed-skills.ts`, the quest seeds (`seed-hsk1-quest`, `seed-spanish-a1-quest`, `seed-learner-quest`, `seed-meta-learning-quest`) and beta codes. **Decision needed:** whether to also export Braga data, if Braga is still readable, and replay it into Tiramisu. That is a separate script, and it is not required to get prod up.
8. Update the docs (§5).

---

## 5. Docs updates

- **New** `docs/betadocs/arkiv/operations/tiramisu-migration.md`, mirroring `braga-migration.md`: network table, SDK changes, the compat layer, data reset and troubleshooting. Register it in `app/api/docs/list/route.ts`.
- Mark `braga-migration.md` as historical.
- Find and replace the Braga chain id, RPC, explorer and faucet across `README.md`, `docs/ENGINEERING_GUIDELINES.md`, `docs/betadocs/**` (`environments.md`, `wallet-architecture.md`, `wallet-authentication-flow.md`, the `integrations/*` pages, `arkiv-client.md`, `sdk-api-verification-guide.md`) and `SECURITY_AUDIT.md`. These are the same files the Braga commit `791c91b` touched.
- Update `sdk-api-verification-guide.md` and `arkiv-client.md` to describe the 0.8 API (`select`, typed attributes, `patchEntity`, `ExpirationTime`, `executeBatch`, `watchEntityEvents`), and note that app code currently reaches it through the compat layer.

---

## 6. Open questions and verification gaps

1. **I could not reach `docs.arkiv.network` or any `*.arkiv.network` RPC** from this environment (its network policy blocks those hosts). The network values above come from the SDK 0.8.1 package source and public READMEs. They need a live check in step 4.2.
2. **Explorer host.** Community repos use `tiramisu.explorer.arkiv.network`. An open issue (Arkiv-Network/skills #27) says the docs list `indexer.tiramisu.db-chain.testnet.arkiv.network` instead. Confirm the host and the URL path format.
3. **Is Braga still up, or already down?** This decides whether a data export (step 4.7) is possible.
4. **Truncating long attributes:** is this acceptable, or should the attribute just be omitted? Before shipping, confirm that every truncated field (`bio`, `description`, `title`, `reason`, URLs, `meta_learning_json`) is also in the payload and is read from there.
5. **Maximum entity lifetime.** We create 10-year entities (`expiresIn: 315360000`). Confirm Tiramisu accepts this, or switch to `ExpirationTime.permanent()`.
6. **Entity keys.** They are generated differently now, so any keys hard-coded in config or seed files (e.g. the wallet in `app/explorer/page.tsx:176`) must be regenerated after the reseed.

---

## 7. Follow-up ("state of the art", after prod is green)

- Migrate modules off the compat layer, module by module, to native `select()`, typed attributes (`u64` timestamps, `bool` flags) and `patchEntity`/`executeBatch`. Delete `compat.ts` when nothing uses it.
- Use `watchEntityEvents` for notifications instead of polling.
- Rebuild the subgraph against the new event ABI, or drop it.
- Upgrade `extractions/*` to 0.8.x and Tiramisu.
- Add a CI smoke test that runs a read-only query against the live testnet, so the next network rotation shows up before users notice it.

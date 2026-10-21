# Plan: Braga → Tiramisu Migration (SDK 0.6.7 → 0.8.1)

Status: **v2, for review**. No application code has changed yet.

Goal: get prod running again on Arkiv's current testnet, built the way current Arkiv projects are built.

**What changed from v1:** v1 proposed a compatibility shim so that no call sites would change. Research into the official Arkiv sources and 12 recent Tiramisu projects (§8) showed that this is the wrong trade:

- Braga data cannot be carried over, so we start on an empty chain anyway.
- Tiramisu **rejects** our camelCase attribute names, so every attribute name has to change at its call site regardless.

On-chain schema decisions are cheap now and expensive later, because changing the schema later means migrating data again. **So v2 settles the on-chain schema now, natively, and defers only code-structure improvements.**

---

## 1. Facts this plan rests on

| Item                     | Value                                                                                                                                       | Source                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Braga                    | **Retired 2026-08-12.** Its endpoints are down, its state does not migrate, and no bridge exists.                                           | Arkiv skills migration guide; SDK 0.8.0 CHANGELOG   |
| Chain                    | `tiramisu` from `@arkiv-network/sdk/chains`: id **7738577** (`0x7614d1`), GLM                                                               | SDK 0.8.1 source                                    |
| RPC                      | `https://rpc.tiramisu.db-chain.testnet.arkiv.network` (wss on the same host)                                                                | SDK 0.8.1 source                                    |
| Explorer                 | **`https://tiramisu.explorer.arkiv.network`**, with paths `/tx/<hash>`, `/entity/<key>`, `/address/<addr>`. The SDK chain object has **no** `blockExplorers`, so we add it ourselves. | Arkiv-Network/skills #27 (closed by PR #53); 8 of 12 projects |
| Faucet                   | `https://hub.arkiv.network/faucet` (wallet sign-in + CAPTCHA)                                                                               | skills `arkiv-first-write`                          |
| Access keys              | `https://hub.arkiv.network/api-keys`. Sent as an `X-API-KEY` header, **server-side only**. Without one, RPC is anonymous and rate-limited (`429 ANON_COST_LIMITED`). | skills `arkiv-app-integration`                      |
| SDK                      | `@arkiv-network/sdk@0.8.1` (npm `latest`) with `viem` as a peer dependency (≥ 2.56 in practice)                                              | npm; skills pin `^0.8.1`                            |
| Attribute names          | `[a-z][a-z0-9_]*`, at most 32 bytes, no reserved words (`key`, `str`, `and`, …). **Tiramisu rejects uppercase** even though the SDK allows it. | skills `arkiv-data-modeling`; SDK issue #128        |
| Limits                   | `str` ≤ 128 bytes (**never truncate**), ≤ 30 user attributes on create, payload ≤ 128 KiB, query page ≤ 200                                  | skills `arkiv/references/limits.md`                 |
| `updateEntity`           | Removed. Use `patchEntity({ set, unset, payload })`. Expiry, owner and flags are not patchable.                                             | SDK CHANGELOG                                       |
| Query operators          | `ne`, `exists` and `hasType` are **rejected by the node**. There is no server-side ordering (newest-created comes first).                   | skills `arkiv-query`                                |

---

## 2. Your three questions, decided

1. **Long text → store it in the JSON payload. Never truncate.** This is official guidance ("put long descriptions and unqueried data in the payload; never silently truncate") and every surveyed project does it. Attributes keep only short scalars that queries filter on. Inputs that will become attributes are validated, and rejected if too long, at the form or API boundary.
   - Concretely, these come **out of attributes**: `bio`, `description`, `title`, `reason`, `video_join_url`, `issue_url`, `meta_learning_json`, `skills` (the CSV) and `skill_<n>`.
   - Most already exist in the payload, and readers already prefer the payload (`profile.ts:659`, `virtualGathering.ts:363`, `githubIssueLink.ts:189`).
   - **Exception:** the learner-quest and language-quest `title` and `description` exist **only** as attributes today (`learnerQuest.ts:173`, `languageQuest.ts:290`, read at `learnerQuest.ts:299`). These must be added to the payload, and their readers switched to read from it.
   - Profiles currently write one attribute per skill (`skill_0…skill_n`), which can exceed the attribute cap. Skills move to the payload. A skill → profile lookup should use the existing `skill` entities and `learning_follow` relations rather than per-index attributes.
2. **Braga data → fresh start, reseed.** Braga is retired, so there is nothing to export. Users re-onboard, and we reseed the curated content (skills, quests, beta codes). Tell beta users in the banner and onboarding copy.
3. **Explorer → `https://tiramisu.explorer.arkiv.network`** for `/tx/`, `/entity/` and `/address/`, defined in one constant.
   - Watch SDK PR #120: it may make `tiramisu.scanner.arkiv.network` the default. Because every link goes through one constant, switching later is a one-line change.

---

## 3. Target on-chain schema (applies to every entity type)

Settled now, because changing it later means migrating data again:

| Rule                      | Spec                                                                                                                                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Namespace                 | Every entity gets `project: 'p2pmentor'` and `type: '<entity_type>'`, and every query filters on both. `space_id` stays for environment and cohort isolation.                                       |
| Version                   | `schema_version: i32(1)` on every entity (as in sitelog, muniment and arkiv-triggers). Readers ignore versions they don't know.                                                                    |
| Names                     | Lowercase `snake_case`. A mechanical rename covers about 100 of the 173 names (`spaceId`→`space_id`, `sessionKey`→`session_key`, …). Five pairs already exist in both spellings (`spaceId`/`space_id`, `createdAt`/`created_at`, `skillId`/`skill_id`, `entityKey`/`entity_key`, `issuedAt`/`issued_at`); each pair merges into one name. |
| Types                     | Timestamps are `u64` milliseconds (`created_at`, `updated_at`, `expires_at`, …; any ISO copies stay in the payload). Wallets are `addr`. References to other entities are `key()`. Flags are `bool`. Everything else is `str`. |
| Payload                   | `jsonToPayload(obj)`, `contentType: 'application/json'`. Holds all text, arrays and nested data. Nothing secret or personal goes in, because payloads are public.                                    |
| Trust                     | Reads of server-signed types (beta codes, grants, revocations, admin notifications, quest definitions) are scoped with `.createdBy(SERVER_SIGNER)`. Matching attribute values alone is not trust, since anyone can copy them. |
| Expiry                    | `ExpirationTime.fromDays(n)` chosen per entity type (§5); **no `permanent()`**. Long-lived types are renewed by a cron job (step 11).                                                                |
| Flags (set at create, cannot change later) | `readonly` for append-only records: `revocation`, `assessment_result`, `tx_event`, `onboarding_event`, `app_feedback`, `review_mode_grant`, `beta_code_usage`, `quest_completion`. Everything else is mutable. |

---

## 4. Changes in the PR to get prod running ("PR 1")

Mechanical steps are done by script and checked with `tsc`, the unit tests and a grep audit. The hand-written parts are small helpers.

| #   | Area                                                   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `package.json`, lockfile                               | Pin `@arkiv-network/sdk@0.8.1` and `viem@^2.57`.                                                                                                                                                                                                                                                                                                                                                                                             |
| 2   | **new** `lib/arkiv/chain.ts`                           | `arkivChain = { ...tiramisu, blockExplorers: { default: { name: 'Arkiv Explorer', url: ARKIV_EXPLORER_BASE_URL } } }`. This is the only chain definition in the app.                                                                                                                                                                                                                                                                         |
| 3   | `lib/arkiv/client.ts`                                  | Import `http` and `custom` from `viem`, and `privateKeyToAccount` from `viem/accounts`. On the server, the transport sends `X-API-KEY` from a new `ARKIV_API_KEY` env var (server-only, never `NEXT_PUBLIC_`). Set `cacheTime: 0`, `fetchOptions: { cache: 'no-store' }`, and an explicit `timeout` and `retryCount` (works around SDK issue #126, a 429 retry hang).                                                                          |
| 4   | **new** `lib/arkiv/schema.ts`                          | `PROJECT`, `SCHEMA_VERSION`, `ENTITY_TYPES`, per-type lifetime and flags (the §5 table), and a `baseAttributes(type)` helper. The `attr` helpers (`u64Now()`, `walletAttr()`, `ref()`) and a `validateAttrInputs()` that throws on more than 128 bytes or more than 30 attributes. **It never truncates.**                                                                                                                                       |
| 5   | **new** `lib/arkiv/read.ts`                            | `getAttr(entity, name)` / `getAttrString()` for the typed `Record` attributes, and `parsePayload(entity)`. `queryAll(builder, max)` pages at most 200 at a time, pinned to `atBlock` of the first page, and replaces `.limit(1000/500/5000)`. There is no server-side ordering, so it also sorts client-side by `created_at`. These replace about 165 hand-rolled `.attributes.find(a => a.key === …)` lookups and about 130 `TextDecoder` blocks. |
| 6   | Writes (43 files in `lib/arkiv`, plus `lib/auth/passkey-recovery.ts`) | Codemod:<br>• `attributes: [{key, value}]` → `attributes: { ...baseAttributes(type), name: value }`<br>• `payload: new TextEncoder().encode(JSON.stringify(x))` → `jsonToPayload(x)`<br>• `expiresIn: n` → `expires: LIFETIME[type]`<br>• add `flags` for readonly types<br>Dynamic `attributes.push(...)` builders are converted by hand (about 15 sites).                                                                                     |
| 7   | Updates (8 sites: `entity-utils.ts`, `profile.ts`, `authIdentity.ts`, `adminNotification.ts`, `notifications.ts`) | `updateEntity` → `patchEntity({ entityKey, set, unset, payload })`. Lifetime extension moves to `extendEntity` with `atBlock(current.expiresAt + n)`, because `fromDays` counts from now (SDK issue #122). Patches are last-writer-wins: keep the existing "read, then write" deterministic pattern.                                                                                                                                             |
| 8   | Queries (about 178 sites)                              | Codemod:<br>• `buildQuery()…withAttributes(true).withPayload(true)` → `select({ key: true, attributes: true, payload: true, … })`, selecting only what each caller reads<br>• rename the field names inside `eq('…')`<br>• add the `project` filter<br>• `.createdBy()` for server-signed types<br>• `.limit(>200)` → `queryAll`                                                                                                                  |
| 9   | Reserved `key` attribute bug                           | 11 lookups such as `.where(eq('key', key))` (`sessions.ts:1022`, `offers.ts:612`, `appFeedback.ts:497`, …) query an attribute named `key`, which never existed and is now a reserved word. Replace them with `getEntity(key)`.                                                                                                                                                                                                                    |
| 10  | Wallets (`lib/auth/metamask.ts`, `walletconnect.ts`, `lib/wallet/getWalletClient*.ts`, `app/auth/page.tsx`) | Use `arkivChain`. Switch to `0x7614d1`, and on error 4902 call `wallet_addEthereumChain` with chain name "Arkiv Tiramisu Testnet" and the explorer URL. Re-check account and chain before each write (official browser-wallet guidance).                                                                                                                                                                                                         |
| 11  | Explorer links (about 46 inline URLs in about 35 files) | Use `getArkivExplorerTxUrl`, `getArkivExplorerEntityUrl` and a new `getArkivExplorerAddressUrl` from `lib/arkiv/explorer.ts`. Fix the hard-coded wallet in `app/explorer/page.tsx:176` so it is derived from the signer.                                                                                                                                                                                                                          |
| 12  | `lib/config.ts`, `signer-metadata.ts`, `betaAccess.ts`, `reviewModeGrant.ts` | Import `privateKeyToAccount` from `viem/accounts`. Expose `SERVER_SIGNER_ADDRESS` for `createdBy` scoping.                                                                                                                                                                                                                                                                                                                                          |
| 13  | Seeds (`scripts/seed-skills.ts`, `seed-*-quest.ts`, beta codes) | Move them to the new schema, so prod can be reseeded on day one. Quest `title` and `description` go in the payload.                                                                                                                                                                                                                                                                                                                         |
| 14  | Tests                                                  | Update `network-config.test.ts` (7738577, the Tiramisu explorer, GLM). Add `schema.test.ts` (name grammar, limits that throw, base attributes) and `read.test.ts` (attribute access, paging). Add a grep guard test that fails on `buildQuery`, `updateEntity`, `expiresIn`, `braga` or camelCase `eq('…')` in `lib/` and `app/`.                                                                                                                  |
| 15  | Copy                                                   | Update the network name, faucet and explorer text in UI copy (`app/auth/page.tsx`, `BetaBanner.tsx`, `IntegrationGuide.tsx`, `content/quests/arkiv/steps/06,11`), and add the "fresh start" notice to the beta banner.                                                                                                                                                                                                                          |

**Deliberately kept the same in PR 1:**

- Server signer vs. user wallets: same as today.
- Browser-side reads stay anonymous.
- `space_id` semantics.
- `scripts/` debug tools beyond the seeds. These are dev-only; a grep guard lists them.
- `extractions/*`.

---

## 5. Lifetime and flags per entity type (starting values, for review)

| Lifetime                         | Types                                                                                                  | Renewal                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| 365 days                         | `user_profile`, `skill`, `learner_quest` / quest definitions, `auth_identity`, `beta_code`             | Cron extends when less than 60 days remain |
| 180 days                         | `ask`, `offer`, `availability`, `session`, `learning_follow`, `garden_note`, `virtual_gathering`, `notification_preference` | Renewed on use                             |
| 90 days                          | `notification`, `admin_notification`, `app_feedback`, `perf_*`, `onboarding_event`                     | None                                       |
| 365 days, `readonly`             | `assessment_result`, `quest_completion`, `revocation`, `tx_event`                                      | Cron                                       |
| Product-defined (7 days, 1 hour, …) | `review_mode_grant`, `lite_ask` / `lite_offer`, `jitsi` / session-link entities                     | None                                       |

The current code uses 10-year and 1-year `expiresIn` values. Official guidance is that lifetimes are a product decision and `permanent()` is not a durability promise. Profile and skill durability comes from the renewal cron, not from a large number.

---

## 6. Rollout

1. Implement PR 1 on this branch. Run `pnpm typecheck && pnpm lint && pnpm test && pnpm build` and the grep guard.
2. **Ops (needs you or an admin):**
   - Create a Hub access key at `hub.arkiv.network/api-keys` and add it to Vercel as `ARKIV_API_KEY` (server-only).
   - Fund the server signer (`ARKIV_PRIVATE_KEY` address) with GLM. The faucet needs a wallet sign-in and a CAPTCHA, so fund a personal wallet there and transfer the GLM to the signer.
3. **Live smoke test on a Vercel preview:**
   - Create a profile with a long bio.
   - Run the ask/offer flows, start a session, and patch a notification.
   - Run the paging path.
   - Check that explorer links open.
   - Sign in with MetaMask (add-chain flow), WalletConnect and passkey.
   - Run the Playwright e2e tests.
4. Reseed prod: skills, quests, beta codes. Promote the preview to prod.
5. Docs (§7).

## 7. Docs

- **New** `docs/betadocs/arkiv/operations/tiramisu-migration.md`, mirroring `braga-migration.md`: the facts table, the schema rules from §3, the lifetime table from §5, the access key setup, the fresh-start notice and troubleshooting (429, unfunded signer, uppercase names). Register it in `app/api/docs/list/route.ts`.
- Mark `braga-migration.md` as historical.
- **Rewrite** `sdk-api-verification-guide.md` and `modules/arkiv-client.md` for the 0.8 API: `select`, typed attributes, `patchEntity`, `ExpirationTime`, flags and `executeBatch`.
- Replace Braga values across `README.md`, `docs/ENGINEERING_GUIDELINES.md`, `docs/betadocs/**` and `SECURITY_AUDIT.md`.
- Add a short `docs/betadocs/arkiv/data-model.md` listing each entity type with its attributes, payload fields, lifetime and flags. This becomes the single source of truth, and it backs the schema test.
- Point the `/admin/m1-exam` code samples at the new API.

## 8. Research basis

- **Official:** Arkiv-Network/skills (entry skill `skills/arkiv`, verified 2026-10-08 for SDK ≥0.8.1 <0.9 on Tiramisu), arkiv-sdk-js 0.8.1 source and CHANGELOG, and the global-tour-stop-pre-devcon rules.
- **Community (Aug–Oct 2026, all on Tiramisu with SDK 0.8.x):** SantiagoDevRel/arkiv-chunking, arkiv-images and postgres-to-entity; ibnweb3/witness; northstar-trustrail/lapse; ttimesai-star/sitelog; TheWeirdDee/muniment; jashwanth0712/tanka; soumyacodes007/arkiv-triggers; Shreyas578/Chetavani; marcos-golem/tiramisu-chat; SlayerAnsh/hackathon-duckdb-indexer.
- **Consensus adopted here:**
  - SDK `tiramisu` import plus an explorer constant
  - `project` + `type` namespace
  - an `i32` schema version
  - typed `u64`, `addr` and `key` attributes
  - long text in the payload
  - per-type `fromDays` lifetimes with renewal, not `permanent()`
  - `readonly` for append-only records
  - trust scoped by `createdBy`
  - field-level `select` with paging pinned to one block
  - switch-then-add chain in the wallet
- **Not verifiable from this environment:** `*.arkiv.network` is blocked by network policy, so all live checks happen in rollout step 3.

## 9. After prod is green ("PR 2" and later)

- Move browser-side reads behind bounded Next.js API routes. This lets the access key cover them and avoids anonymous 429s; 18+ client pages query Arkiv directly today.
- Add a renewal cron at `/api/cron/extend-lifetimes`, extending in batches with `executeBatch`.
- Use `executeBatch` + `predictEntityKeys` for multi-entity writes (session + notification, quest + steps).
- Use `watchEntityEvents` as a refresh signal for notifications; it only triggers a re-query.
- Remove `subgraph/` and the `USE_SUBGRAPH_FOR_NETWORK` flag. Its manifest targets the retired system address. If an index is needed, follow the official `eth_getLogs` replay pattern.
- Upgrade `extractions/*` to 0.8.1 / Tiramisu, and update the remaining `scripts/`.
- Add a CI smoke job that runs one read-only query against Tiramisu, so the next network rotation is caught early.

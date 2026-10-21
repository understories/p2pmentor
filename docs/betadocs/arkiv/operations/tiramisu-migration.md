# Tiramisu Testnet Migration

## Overview

In October 2026 p2pmentor moved from the Arkiv Braga testnet to the **Tiramisu** testnet, and from `@arkiv-network/sdk` 0.6.7 to **0.8.1**.

Arkiv retired Braga on 2026-08-12. Braga's endpoints no longer respond, its entities cannot be migrated, and SDK 0.8 removed the `braga` chain. SDK 0.6.7 cannot talk to Tiramisu either: the RPC schema, the attribute encoding and the Arkiv system address all changed. So this is more than a chain swap. Entity writes, queries and the on-chain schema all moved to the 0.8 model.

**Data was reset.** Tiramisu started empty. Users re-create their profiles, and curated content (skills, quests, beta codes) is reseeded.

The planning document is [docs/TIRAMISU_MIGRATION_PLAN.md](../../../TIRAMISU_MIGRATION_PLAN.md).

## Network

| Field           | Braga (retired)                              | Tiramisu (current)                                    |
| --------------- | -------------------------------------------- | ----------------------------------------------------- |
| Chain id        | 60138453102                                  | **7738577** (`0x7614d1`)                              |
| RPC (HTTP)      | `https://braga.hoodi.arkiv.network/rpc`      | `https://rpc.tiramisu.db-chain.testnet.arkiv.network` |
| RPC (WebSocket) | `wss://braga.hoodi.arkiv.network/rpc/ws`     | `wss://rpc.tiramisu.db-chain.testnet.arkiv.network`   |
| Explorer        | `https://explorer.braga.hoodi.arkiv.network` | `https://tiramisu.explorer.arkiv.network`             |
| Explorer paths  | `/tx/`, `/entity/`, `/address/`              | `/tx/<hash>`, `/entity/<key>`, `/address/<addr>`      |
| Faucet          | `braga.hoodi.arkiv.network/faucet`           | `https://hub.arkiv.network/faucet` (wallet sign-in)   |
| Access keys     | n/a                                          | `https://hub.arkiv.network/api-keys`                  |
| Native currency | GLM                                          | GLM                                                   |
| SDK chain       | `braga`                                      | `tiramisu` (`@arkiv-network/sdk/chains`)              |

The SDK's `tiramisu` object has no `blockExplorers` entry, so `lib/arkiv/chain.ts` defines `arkivChain`, the app's single chain definition with the explorer added. It also exports the `wallet_addEthereumChain` parameters used by the MetaMask, WalletConnect and `/auth` flows.

## Environment

| Variable                           | Where       | Purpose                                                                                                                                                           |
| ---------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ARKIV_PRIVATE_KEY`                | server      | Server signing wallet. Fund it with Tiramisu GLM.                                                                                                                 |
| `ARKIV_API_KEY`                    | server only | Hub access key, sent as an `X-API-KEY` header on server-side RPC calls. Without it, RPC is anonymous and rate-limited (`429`). **Never expose it as `NEXT_PUBLIC_`.** |
| `NEXT_PUBLIC_ARKIV_SIGNER_ADDRESS` | public      | Lowercase address of the server signer. Lets browser-side reads trust only server-signed entities, and is linked from `/explorer`.                                 |

**Funding the server signer.** The faucet needs a wallet sign-in and a CAPTCHA. Request GLM to a browser wallet, then transfer it to the signer address.

## SDK 0.6.7 → 0.8.1 changes

| 0.6.7                                                   | 0.8.1                                                                                        | p2pmentor helper                                         |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `buildQuery().where(eq()).withAttributes().withPayload()` | `select({ ...fields }).where(eq())`                                                          | `arkivSelect(type)` in `lib/arkiv/read.ts`               |
| `.limit(n)`, unbounded                                  | max 200 per page; cursor paging                                                              | `fetchAll(builder, max)` (pinned to one block)           |
| `attributes: [{ key, value }]`                          | `attributes: { name: typedValue }` (`str`, `i32`, `u64`, `addr`, …)                          | `entityAttributes(type, record)` in `lib/arkiv/schema.ts` |
| `entity.attributes.find(a => a.key === …)`              | `entity.attributes[name] = { type, value }`                                                  | `getAttr(entity, name)`, `attrsToRecord(entity)`         |
| `expiresIn: seconds`                                    | `expires: ExpirationTime.fromSeconds(…)`                                                     | `lifetimeFor(type, seconds?)`                            |
| `updateEntity` (full replace)                           | `patchEntity({ set, unset, payload })`; expiry/owner/flags not patchable                     | `replaceArkivEntity(…)` in `lib/arkiv/write.ts`          |
| —                                                       | creation flags (`readonly`, `permissionlessExtension`), set at create                        | `flagsFor(type)`                                         |
| `privateKeyToAccount` from `sdk/accounts`               | `viem/accounts` (viem is a peer dependency)                                                  | —                                                        |
| `http`, `custom` from the SDK root                      | from `viem`                                                                                  | —                                                        |

All writes go through `createArkivEntity` / `replaceArkivEntity` (or `arkivUpsertEntity`). All queries start from `arkivSelect`, which filters on `project = 'p2pmentor'`.

## Schema rules

These are new on-chain rules, applied to every entity. See [Data Model](data-model.md).

- **Namespace:** `project: 'p2pmentor'` + `type` on every entity. `space_id` still isolates environments and cohorts.
- **Version:** `schema_version: i32(1)`.
- **Names:** lowercase `snake_case`. Tiramisu rejects uppercase attribute names, so `spaceId` became `space_id`, `createdAt` became `created_at`, and so on.
- **Types**, derived from name and value identically on write and query:
  - wallet-like names (`wallet`, `*_wallet`, `*_by`) → `addr`
  - `*_at` → `u64` epoch milliseconds
  - everything else → `str`
- **Limits:** a string attribute is at most 128 bytes. Writes **throw** on longer values; nothing is ever truncated. Long text (bios, descriptions, titles, reasons, URLs, notes) lives in the JSON payload only. Each entity has at most 30 attributes.
- **Trust:** reads of server-signed types (beta access, beta code usage, review grants, revocations, admin notifications, quest definitions) are scoped with `.createdBy(SERVER_SIGNER_ADDRESS)`.
- **Lifetimes:** chosen per type (`lib/arkiv/schema.ts`); no `permanent()`.
  - 365 days: identity and curated content
  - 180 days: activity
  - 90 days: operational records
  - product-specific values (user TTLs, grants, gatherings) are passed explicitly
- **Readonly:** append-only types (revocations, assessment results, tx events, onboarding events, app feedback, review grants, beta code usage, quest completions) are created `readonly`.
- **Queries:** `ne`, `exists` and `hasType` are rejected by the node, and there is no server-side ordering (newest-created comes first). Filter and sort on the client.

Patches do not extend expiry. Long-lived entities rely on renewal, which is a follow-up: a cron job that extends lifetimes with `extendEntity` / `executeBatch`.

## Tests

- `__tests__/lib/arkiv/network-config.test.ts`: chain id 7738577, RPC, explorer URLs, add-chain params.
- `__tests__/lib/arkiv/schema.test.ts`: namespace attributes, typing, the 128-byte and attribute-count limits (which throw), name grammar, lifetimes, flags, read helpers.
- `__tests__/lib/arkiv/sdk-migration-guard.test.ts`: fails if `lib/`, `app/` or `components/` reintroduce `buildQuery`, `updateEntity`, `expiresIn`, `withAttributes`, `sdk/accounts`, Braga hosts, `{key, value}` attribute arrays, `eqAttr('key')`, or camelCase attribute names.

## Troubleshooting

| Symptom                                                    | Cause / fix                                                                                                             |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `Execution error without revert data` / insufficient funds | The signing wallet has no Tiramisu GLM. Fund it via the Hub faucet.                                                     |
| HTTP `429` / `ANON_COST_LIMITED`                           | No access key. Set `ARKIV_API_KEY` on the server.                                                                       |
| `Invalid attribute name "…"`                               | A camelCase or invalid name. Use snake_case.                                                                            |
| `Attribute "…" is N bytes; max is 128`                     | Long text in an attribute. Move it to the payload.                                                                      |
| Query returns nothing after a schema change                | Write and query must use the same attribute name and type. Always use `entityAttributes` and `eqAttr`.                  |
| `limit N exceeds the node maximum of 200`                  | Use `fetchAll(builder, N)`.                                                                                             |
| MetaMask is on the wrong network                           | Use "Add Arkiv Tiramisu Testnet to Wallet" on `/auth`, or chain id `0x7614d1`.                                           |

## Not migrated (follow-ups)

- `extractions/*` still target the old SDK and are excluded from the root type-check.
- `subgraph/` targets the retired system address. Keep `USE_SUBGRAPH_FOR_NETWORK` off.
- Browser-side reads are anonymous. The follow-up moves them behind API routes so the access key covers them.
- Lifetime renewal cron, `executeBatch` for multi-entity writes, and `watchEntityEvents` refresh.

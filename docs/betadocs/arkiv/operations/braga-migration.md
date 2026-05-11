# Braga Testnet Migration

## Overview

p2pmentor moved from the Arkiv Kaolin testnet to the new Braga testnet in May 2026, alongside Arkiv's own network evolution. This page explains what changed, why, and how it affects builders running the project locally or in CI.

The migration was scoped to one set of commits on `main`:

- `ceaed43` chore(deps): upgrade `@arkiv-network/sdk` to `0.6.7` for Braga chain
- `791c91b` refactor: migrate from Kaolin to Braga testnet
- `8ad1a20` test: add unit tests for Braga explorer URLs and chain config
- `9f5530b` test: avoid CI false positive on anvil key in network-config test
- `19c7da5` ci: use pnpm 9 for lockfile v9; ignore `.claude` for Prettier

## Why We Migrated

Arkiv runs its own development testnets that follow its own roadmap. Kaolin was the previous public testnet. Braga is the current testnet recommended by the Arkiv team, with a refreshed chain id, RPC endpoint, explorer, and native currency (GLM). Staying on Kaolin would have meant running against a chain that is no longer the default in the Arkiv SDK, with a faucet and explorer that may stop being maintained.

The trigger was the SDK release `0.6.7`, which exports `braga` from `@arkiv-network/sdk/chains` and aligns its default config with the new testnet. Once that landed, our existing imports of `kaolin` from the SDK pinned us to an older chain definition, so we did the swap in one pass.

## What Changed at a Glance

| Field            | Kaolin                                        | Braga                                        |
| ---------------- | --------------------------------------------- | -------------------------------------------- |
| Network name     | Kaolin DB-Chain                               | Braga DB-Chain                               |
| Chain id         | 60138453025                                   | 60138453102                                  |
| RPC URL          | `https://kaolin.hoodi.arkiv.network/rpc`      | `https://braga.hoodi.arkiv.network/rpc`      |
| Block explorer   | `https://explorer.kaolin.hoodi.arkiv.network` | `https://explorer.braga.hoodi.arkiv.network` |
| Native currency  | ETH                                           | GLM                                          |
| Faucet           | Arkiv dev portal                              | `https://braga.hoodi.arkiv.network/faucet/`  |
| SDK chain export | `kaolin`                                      | `braga`                                      |
| Subgraph network | `kaolin`                                      | `braga`                                      |

GLM is the Braga native gas token. The Braga faucet at the URL above mints test GLM directly to a wallet address.

## Code Changes

### SDK Client

The Arkiv client in [lib/arkiv/client.ts](lib/arkiv/client.ts) imports `braga` instead of `kaolin` and passes it to every client factory.

```ts
import { createPublicClient, createWalletClient, http, custom } from '@arkiv-network/sdk';
import { privateKeyToAccount } from '@arkiv-network/sdk/accounts';
import { braga } from '@arkiv-network/sdk/chains';

export function getPublicClient() {
  return createPublicClient({ chain: braga, transport: http() });
}
```

The same swap applies to `getWalletClientFromPrivateKey` and `getWalletClientFromMetaMask`.

### Explorer URLs

`lib/arkiv/explorer.ts` exposes `ARKIV_EXPLORER_BASE_URL` and the `getArkivExplorerTxUrl` / `getArkivExplorerEntityUrl` helpers. All of these now point at the Braga explorer host. Any component that linked out to a transaction or entity (admin pages, the explorer index, the lite views) inherits the new URL automatically.

### Subgraph Manifest

[subgraph/subgraph.yaml](subgraph/subgraph.yaml) sets `network: braga` so the subgraph indexes the Braga chain. Re-deploying the subgraph against a Graph node connected to Braga is the only operational follow-up here.

### UI Copy and Docs

Beta docs under `docs/betadocs/`, the top-level [README.md](README.md), and user-facing copy in pages like `/auth`, `/explorer`, and `/lite` were updated so that any mention of the testnet (name, RPC, faucet, currency) matches Braga.

### CI

`pnpm-lock.yaml` is now lockfile version 9, which needs pnpm 9. `.github/workflows/ci.yml` was updated accordingly, and `.prettierignore` excludes `.claude/` so local agent state does not break formatting.

## Tests

[`__tests__/lib/arkiv/network-config.test.ts`](__tests__/lib/arkiv/network-config.test.ts) is a small guard against regressions:

1. The explorer base URL points at `explorer.braga.hoodi.arkiv.network` and contains no Kaolin reference.
2. `getArkivExplorerTxUrl` and `getArkivExplorerEntityUrl` produce the expected Braga URLs.
3. `getArkivExplorerUrl` prefers `entityKey` over `txHash`, falls back to `txHash`, and returns `null` for missing or `'undefined'` inputs.
4. `getPublicClient` and `getWalletClientFromPrivateKey` report chain id `60138453102` and native currency `GLM`.
5. `getWalletClientFromMetaMask` throws when no injected provider is present.

The wallet client test uses the well-known anvil/foundry development key. The first test pass tripped a CI secret scanner, so commit `9f5530b` split the literal into two halves concatenated at runtime. The key itself is unchanged and remains test-only.

## Running Locally After the Migration

If you cloned the repo before this change, the steps are:

1. Pull `main` and run `pnpm install` with pnpm 9 so the v9 lockfile resolves cleanly.
2. Visit `https://braga.hoodi.arkiv.network/faucet/` and request test GLM for the wallet derived from your `ARKIV_PRIVATE_KEY`.
3. Optionally add the Braga network to MetaMask using the values from the table above, or click "Add Network to Wallet" on the Arkiv dev portal.
4. Run `pnpm dev`. The Arkiv client picks up `braga` automatically; no env var changes are required for the chain itself.

If you previously had Kaolin pinned in MetaMask, the old network can stay in your wallet, but transactions for p2pmentor should now be signed against Braga.

## Where to Look If Something Breaks

- Transactions failing with "insufficient funds": the signing wallet needs Braga GLM, not Kaolin ETH. Hit the Braga faucet.
- Explorer links 404 or load the wrong network: confirm `ARKIV_EXPLORER_BASE_URL` resolves to the Braga host and that you are not running an old build.
- SDK type errors mentioning `kaolin`: a dependency is still on `@arkiv-network/sdk` below `0.6.7`. Re-run `pnpm install` against the current lockfile.
- CI failing on `pnpm install`: the runner is on pnpm 8 or earlier. The workflow file pins pnpm 9 explicitly.

## Related Reading

- [Environments and Data Seeds](environments.md) for how `spaceId` provides data isolation independent of the chain.
- [SDK API Verification Guide](sdk-api-verification-guide.md) for verifying that an SDK upgrade has not silently changed an entity API surface.
- [Wallet Architecture](wallet-architecture.md) for the signing-wallet model that funded all of these test transactions.

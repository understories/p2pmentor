# Security patches: 2026-10-22

## Summary

`pnpm audit` on `main` reported 134 advisories (6 critical, 69 high, 52 moderate, 7 low). This update moves every affected package to a patched release within its current major version, using direct version bumps where the package is a direct dependency and scoped `pnpm.overrides` where it is transitive. After the update, `pnpm audit` reports 20 advisories (3 critical, 3 high, 12 moderate, 2 low). All remaining advisories need a semver-major upgrade and are listed under [Not fixed](#not-fixed).

The same day, CI moved from Node 20 to Node 22.23.4, and the E2E job was pinned to an Ubuntu 24.04 runner.

## Dependency changes

Direct dependencies (edited in `package.json`):

| Package                         | From   | To      | Advisories                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Why it matters here                                                                                                                                      |
| ------------------------------- | ------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `next`                          | 15.5.9 | 15.5.28 | GHSA-p293-qw3h-jr36 (CVE-2026-75604), GHSA-2xp9-vwfh-vxw4 (critical, RCE: Windows-hosted servers and the Image Optimization API); 28 more high/moderate/low, including middleware bypasses (GHSA-26hh-7cqf-hhc6, GHSA-492v-c6pp-mqqv, GHSA-267c-6grr-h53f, GHSA-36qx-fr4f-26g5), SSRF (GHSA-c4j6-fc7j-m34r, GHSA-89xv-2m56-2m9x, GHSA-p9j2-gv94-2wf4), Server Components and Server Action DoS (GHSA-q4gf-8mx6-v5v3, GHSA-8h8q-6873-q5fj, GHSA-m99w-x7hq-7vfj), cache poisoning (GHSA-4jqv-mc3x-m676, GHSA-mcj8-r9mp-w47p) | Production server framework. The app uses App Router, `middleware.ts` and `next/image`, which are the affected areas.                                    |
| `sharp` (via `next`)            | 0.34.5 | 0.35.5  | GHSA-f88m-g3jw-g9cj, GHSA-rgj7-g3m4-5g8c, GHSA-wq5f-xc86-pv6w (libvips, libheif, librsvg)                                                                                                                                                                                                                                                                                                                                                                                                                                  | Image decoding for `next/image` on self-hosted servers. `next@15.5.28` declares `^0.34.3 \|\| ^0.35.5`, so this stays inside the range Next.js supports. |
| `eslint-config-next`            | 15.5.9 | 15.5.28 | (kept in step with `next`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Lint tooling.                                                                                                                                            |
| `vitest`, `@vitest/coverage-v8` | 2.1.8  | 2.1.9   | GHSA-9crc-q9x8-hgqq (CVE-2025-24964, critical: RCE when a malicious site is visited while the Vitest API server runs)                                                                                                                                                                                                                                                                                                                                                                                                      | Developer machines running `pnpm test:watch`.                                                                                                            |
| `@playwright/test`              | 1.51.1 | 1.64.1  | GHSA-7mvr-c777-76hp (CVE-2025-59288: browser downloads not verified)                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `playwright install` in CI and on developer machines.                                                                                                    |
| `postcss`                       | 8.5.6  | 8.5.31  | GHSA-6g55-p6wh-862q (CVE-2026-45623), GHSA-r28c-9q8g-f849 (CVE-2026-73646), GHSA-qx2v-qp2m-jg93, GHSA-fxqj-rqcc-2cmp                                                                                                                                                                                                                                                                                                                                                                                                       | Build-time CSS processing. The override also moves the copy pinned inside `next` from 8.4.31 to 8.5.31.                                                  |

Transitive dependencies (scoped `pnpm.overrides`, each limited to its current major):

| Package                     | From                   | To             | Advisories                                                                                                                                        | Pulled in by                                                                            |
| --------------------------- | ---------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `h3`                        | 1.15.4                 | 1.15.11        | GHSA-mp2g-9vg9-f4cg (request smuggling), GHSA-22cc-p3c6-wpvm, GHSA-wr4h-v87w-p3r7, GHSA-4hxc-9384-m385, GHSA-72gr-qfp7-vwhw                       | `@walletconnect/ethereum-provider` (browser bundle)                                     |
| `defu`                      | 6.1.4                  | 6.1.7          | GHSA-737v-mqg7-c878 (prototype pollution)                                                                                                         | `@walletconnect/ethereum-provider`                                                      |
| `ws`                        | 7.5.10, 8.17.1, 8.18.3 | 7.5.13, 8.22.0 | GHSA-96hv-2xvq-fx4p (memory exhaustion), GHSA-58qx-3vcg-4xpx                                                                                      | `@walletconnect/*`, `@metamask/sdk`, `jsdom`                                            |
| `socket.io-parser`          | 4.2.4                  | 4.2.7          | GHSA-677m-j7p3-52f9, GHSA-2m8v-j782-fhvr (memory exhaustion)                                                                                      | `@metamask/sdk`                                                                         |
| `preact`                    | 10.28.0                | 10.29.8        | GHSA-36hm-qxxp-pg3m (JSON VNode injection)                                                                                                        | `react-force-graph-2d`                                                                  |
| `lodash`, `lodash-es`       | 4.17.23, 4.17.21       | 4.18.1         | GHSA-r5fr-rjxr-66jc (code injection via `_.template`), GHSA-f23m-r3pf-42rh, GHSA-xxjr-mmjv-4gpg                                                   | `react-force-graph-2d`, `@testing-library/jest-dom`                                     |
| `form-data`                 | 4.0.5                  | 4.0.6          | GHSA-hmw2-7cc7-3qxx (CRLF injection)                                                                                                              | `jsdom` (tests)                                                                         |
| `markdown-it`, `linkify-it` | 14.1.1, 5.0.0          | 14.3.3, 5.0.2  | GHSA-gfr2-rv44-r23c, GHSA-r7fv-28h4-cvq7, GHSA-22p9-wv53-3rq4, GHSA-v245-v573-v5vm and others (quadratic DoS)                                     | `@arkiv-network/sdk` (via `typedoc`)                                                    |
| `js-yaml`                   | 4.1.1                  | 4.3.2          | GHSA-52cp-r559-cp3m, GHSA-5p4m-2wfm-xmqj, GHSA-2883-xcg3-v3hh, GHSA-h67p-54hq-rp68 (quadratic DoS)                                                | `eslint`                                                                                |
| `rollup`                    | 4.56.0                 | 4.64.10        | GHSA-mw96-cpmx-2vgc (arbitrary file write)                                                                                                        | `vite` (tests)                                                                          |
| `minimatch`                 | 3.1.2, 9.0.5           | 3.1.5, 9.0.9   | GHSA-3ppc-4f35-3m26, GHSA-7r86-cg39-jmmj, GHSA-23c5-xmqv-rm74 (ReDoS)                                                                             | `eslint`, `test-exclude`                                                                |
| `brace-expansion`           | 1.1.12, 2.0.2          | 1.1.21, 2.1.7  | GHSA-3jxr-9vmj-r5cp, GHSA-mh99-v99m-4gvg, GHSA-rgw5-rvv9-x895, GHSA-qhr7-859c-m2p7, GHSA-6j4f-fj2g-mc7p, GHSA-f886-m6hf-6m8v, GHSA-q2hr-2g5m-vwhr | `minimatch`                                                                             |
| `picomatch`                 | 2.3.1, 4.0.3           | 2.3.2, 4.0.7   | GHSA-c2c7-rcm5-vvqj, GHSA-3v7f-55p6-f55p                                                                                                          | lint tooling                                                                            |
| `nanoid`                    | 3.3.11                 | 3.3.20         | GHSA-28wg-ghj8-5hjv, GHSA-2v37-7h3g-55p8, GHSA-xwg4-73v4-xw9w                                                                                     | `postcss`                                                                               |
| `flatted`                   | 3.3.3                  | 3.4.4          | GHSA-25h7-pfq9-p65f, GHSA-rf6f-7fwh-wjgh                                                                                                          | `eslint`                                                                                |
| `browserslist`              | 4.28.1                 | 4.29.4         | GHSA-c83g-rgw3-j3cx, GHSA-73wf-gq98-2v4g                                                                                                          | `@babel/core` (requires `caniuse-lite` 1.0.30001816 and `electron-to-chromium` 1.5.459) |
| `baseline-browser-mapping`  | 2.9.4                  | 2.11.30        | GHSA-w5vr-8v7q-w6rv                                                                                                                               | `browserslist`                                                                          |
| `source-map-js`             | 1.2.1                  | 1.2.2          | GHSA-68fv-2mgg-jv7q                                                                                                                               | `@vitest/coverage-v8`                                                                   |
| `yaml`                      | 2.6.1, 2.8.2           | 2.9.1          | GHSA-48c2-rrv3-qjmp                                                                                                                               | `tailwindcss`                                                                           |
| `postcss-selector-parser`   | 6.0.10, 6.1.2          | 6.1.5          | GHSA-w9m9-85wc-3x92                                                                                                                               | `tailwindcss`                                                                           |
| `ajv`                       | 6.12.6                 | 6.15.0         | GHSA-2g4f-4pwh-qvx6                                                                                                                               | `eslint`                                                                                |
| `@babel/core`               | 7.28.6                 | 7.29.7         | GHSA-4x5r-pxfx-6jf8                                                                                                                               | `@vitejs/plugin-react`                                                                  |

The `ws@7` override is scoped to `@walletconnect/jsonrpc-ws-connection>ws`. A plain `ws@^7` override also rewrote the `ws` peer range of `isows` (used by `viem`) and caused an unmet peer warning.

## Earlier fix today: Node.js 20 to 22.23.4 in CI

Commit `52c56fe` changed `node-version` from 20 to `22.23.4` in `.github/workflows/ci.yml` and in `extractions/*/.github/workflows/ci.yml`.

Reason: the Node.js 2026-10-21 security releases fix CVE-2026-111497 and 9 related CVEs, including a Brotli decoder remote code execution reachable through `fetch()` and two TLS certificate validation bypasses. Node.js 20 is end of life and does not receive these fixes.

On that push, Quality Checks, Security Scan and Build passed. E2E Tests failed for the runner reason below.

## CI fix: E2E runner pinned to ubuntu-24.04

`ubuntu-latest` on GitHub Actions now resolves to Ubuntu 26.04. With Playwright 1.51.1, `pnpm exec playwright install --with-deps chromium` fails with `Playwright does not support chromium on ubuntu26.04-x64`, so the E2E job failed before running any test.

The E2E job now uses `runs-on: ubuntu-24.04`. Playwright supports this image, and the change affects one line. The other jobs do not install browsers and stay on `ubuntu-latest`. This update also moves Playwright to 1.64.1 for GHSA-7mvr-c777-76hp, but we have not confirmed that 1.64.1 supports Ubuntu 26.04, so the pin stays. Remove it once a Playwright release that supports Ubuntu 26.04 is verified in CI.

## Verification

Run locally on macOS with Node 22.23.4 and pnpm 9.15.9 (the versions CI uses), before and after the change:

| Step       | Command                                       | Before                                  | After                                  |
| ---------- | --------------------------------------------- | --------------------------------------- | -------------------------------------- |
| Install    | `pnpm install --frozen-lockfile`              | pass                                    | pass                                   |
| Format     | `pnpm format:check`                           | pass                                    | pass                                   |
| Lint       | `pnpm lint`                                   | pass (1579 warnings)                    | pass (1579 warnings)                   |
| Types      | `pnpm typecheck`                              | pass                                    | pass                                   |
| Unit tests | `pnpm test`                                   | 37/37 pass                              | 37/37 pass                             |
| Build      | `pnpm build`                                  | pass (120 static pages)                 | pass (120 static pages)                |
| E2E        | `pnpm exec playwright test` (chromium, local) | 4/4 pass (1.51.1)                       | 4/4 pass (1.64.1)                      |
| Audit      | `pnpm audit`                                  | 6 critical, 69 high, 52 moderate, 7 low | 3 critical, 3 high, 12 moderate, 2 low |

The E2E run used a local config that serves the app on another port. The CI E2E job on `ubuntu-24.04` has not run yet. No step needed secrets.

## Not fixed

Each remaining advisory needs a semver-major upgrade, which is out of scope for this patch.

| Package                    | Version        | Advisories                                                                                 | Needed                   | Exposure                                                         |
| -------------------------- | -------------- | ------------------------------------------------------------------------------------------ | ------------------------ | ---------------------------------------------------------------- |
| `vitest`, `@vitest/mocker` | 2.1.9          | GHSA-5xrq-8626-4rwp (critical, Vitest UI server), GHSA-82fw-gwwq-j7x9, GHSA-qxg6-89mg-rqv8 | vitest 3.2.6 / 4.1.12    | Dev only. Applies when the Vitest UI or API server is listening. |
| `tinypool`                 | 1.1.1          | GHSA-5gmw-xhrv-c9v3, GHSA-85c8-ppgw-ccpr (critical, prototype pollution to RCE)            | 2.1.2                    | Dev only, pulled in by vitest 2.                                 |
| `vite`, `esbuild`          | 5.4.21, 0.21.5 | GHSA-fx2h-pf6j-xcff, GHSA-587h-7wmj-h5pm (high, Windows), GHSA-67mh-4wv8-2f99 and 6 more   | vite 6.4.4, esbuild 0.25 | Dev only (test runner). The app is built with Next.js, not Vite. |
| `braces`                   | 3.0.3          | GHSA-vfj7-8cjw-p6xm (high, stack exhaustion)                                               | none published           | Dev only (`tailwindcss` file watcher, lint).                     |
| `uuid`                     | 8.3.2, 9.0.1   | GHSA-w5hq-g745-h8pq (moderate, v3/v5/v6 with a caller buffer)                              | 11.1.1                   | Pulled in by `@metamask/sdk`. Fix requires MetaMask to update.   |
| `postcss-selector-parser`  | 6.1.5          | GHSA-rj75-hqrm-r3gf (moderate, CPU exhaustion)                                             | 7.1.6                    | Build time, via `tailwindcss` 3.                                 |
| `@simplewebauthn/server`   | 9.0.3          | GHSA-6hxq-p678-4hr2 (low, attestation check)                                               | 13.3.2                   | Runtime. Fix requires migrating from v9 to v13.                  |

The next step is upgrading to vitest 3 or 4, which clears the vitest, tinypool, vite and esbuild entries.

`extractions/arkiv-nextjs-starter` and `extractions/arkiv-app-kit` have no lockfile in this repository, so `pnpm audit` does not cover them. The starter declares `next@^14.0.0`, which resolves to 14.2.35. The Next.js advisories above list fixes only in the 15.5 line, so a project created from the starter should move to `next@15.5.28` or later.

## For forks and deployers

1. Pull these changes and run `pnpm install --frozen-lockfile`.
2. Redeploy. A running server keeps the old `next` and `sharp` until it is rebuilt.
3. If you self-host, run Node.js 22.23.4 or later (or another release line patched on 2026-10-21). Do not run Node.js 20.
4. If your CI uses `ubuntu-latest` with `playwright install --with-deps`, pin the runner to `ubuntu-24.04` or verify your Playwright version supports Ubuntu 26.04.
5. Do not expose the Vitest UI (`vitest --ui`) or Vite dev servers on untrusted networks until the test tooling is upgraded.

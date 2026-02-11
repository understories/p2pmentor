# CI/CD and Quality Pipeline

## Overview

p2pmentor uses a two-system approach to continuous integration and deployment:

- **GitHub Actions** handles code quality, security scanning, and build verification on every push and pull request
- **Vercel** handles production deployment, environment variables, and scheduled tasks

This separation follows a clear principle: GitHub Actions validates code quality, Vercel deploys and runs it. There is no overlap between the two.

## Pipeline Architecture

```
Push to main / PR
        |
        v
  +-----+-----+
  |             |
  v             v
Quality       Security
Checks        Scan
  |             |
  v             |
Build           |
  |             |
  v             |
E2E Tests       |
(non-blocking)  |
  |             |
  +------+------+
         |
         v
  Vercel Deploy
  (automatic on main)
```

### GitHub Actions Jobs

The CI workflow (`.github/workflows/ci.yml`) runs four jobs:

| Job            | Depends On     | Blocking                 | Purpose                              |
| -------------- | -------------- | ------------------------ | ------------------------------------ |
| Quality Checks | -              | Yes                      | Type check, unit tests, format, lint |
| Security Scan  | -              | Yes                      | Secret detection, refs/ protection   |
| Build          | Quality Checks | Yes                      | Verify production build succeeds     |
| E2E Tests      | Build          | No (`continue-on-error`) | Smoke tests against built app        |

### Quality Checks

Runs on every push to `main` and every pull request targeting `main`.

**Blocking steps** (must pass):

- `pnpm typecheck` - TypeScript compilation with `--noEmit`
- `pnpm test` - Vitest unit tests

**Non-blocking steps** (`continue-on-error: true`):

- `pnpm format:check` - Prettier formatting verification
- `pnpm lint` - ESLint with Next.js rules

Non-blocking steps report warnings in the CI output but do not fail the pipeline. This allows incremental cleanup of formatting and lint warnings without blocking development.

### Security Scan

Runs in parallel with quality checks. Scans for:

- AWS access keys (`AKIA...`)
- Private key headers (`-----BEGIN ... PRIVATE KEY-----`)
- 64-character hex strings that may be private keys (`0x...`)
- Tracked files in `refs/` (which must remain gitignored)

Excludes lockfiles, `.env.example`, docs, and markdown files from hex pattern matching to avoid false positives on documented transaction hashes.

### Build

Runs `pnpm build` (Next.js production build) after quality checks pass. This catches issues that type checking alone misses, such as missing environment variable references at build time or incompatible module resolution.

### E2E Tests

Runs Playwright smoke tests (`e2e/smoke.spec.ts`) against the built application. These tests verify that core pages load and render correctly. E2E tests are non-blocking (`continue-on-error: true`) because they depend on external services and may have transient failures.

---

## Toolchain

### Package manager

The project uses **pnpm 8** with lockfile version 6.1. The CI workflow pins `pnpm/action-setup@v2` to version 8 to match.

The lockfile version must stay aligned with the pnpm version used in CI. If you upgrade pnpm locally, regenerate the lockfile and update the version in `.github/workflows/ci.yml` across all three jobs (quality, build, e2e).

### Node version

All CI jobs use **Node.js 20** via `actions/setup-node@v4`.

### Test frameworks

- **Unit tests**: Vitest (`vitest.config.ts`), running in jsdom environment
- **E2E tests**: Playwright (`playwright.config.ts`), running against Chromium

Vitest excludes `e2e/`, `scripts/`, `subgraph/`, `extractions/`, and `refs/` directories to avoid picking up Playwright tests or utility scripts.

---

## Local Development Workflow

### Before every commit

Per [Engineering Guidelines](/docs/philosophy/engineering-guidelines), verify locally before committing:

```bash
pnpm typecheck        # Must pass
pnpm test             # Must pass
pnpm build            # Must pass
git diff --check      # No whitespace issues
```

### Pre-commit hooks

Husky runs `lint-staged` on every commit, which applies ESLint fixes and Prettier formatting to staged TypeScript files. This handles most formatting automatically.

### Running the full CI locally

To simulate the full quality pipeline locally:

```bash
pnpm format:check     # Non-blocking (informational)
pnpm lint             # Non-blocking (informational)
pnpm typecheck        # Blocking
pnpm test             # Blocking
pnpm build            # Blocking
```

---

## Vercel Deployment

Vercel deploys the application automatically on every push to `main` and creates preview deployments for pull requests.

### What Vercel handles

- **Production deployment**: Automatic on push to `main`
- **Preview deployments**: Automatic on pull requests
- **Environment variables**: Managed in Vercel dashboard, not in CI
- **Cron jobs**: Defined in `vercel.json`, executed by Vercel

### What Vercel does not handle

- Code quality checks (GitHub Actions)
- Security scanning (GitHub Actions)
- Unit or E2E test execution (GitHub Actions)

### Scheduled tasks

Defined in `vercel.json`:

| Route                        | Schedule                | Purpose                   |
| ---------------------------- | ----------------------- | ------------------------- |
| `/api/cron/daily-aggregates` | Daily at midnight UTC   | Aggregate daily metrics   |
| `/api/cron/weekly-retention` | Mondays at midnight UTC | Compute retention metrics |

### Admin operations

Entity syncing, seeding, and other administrative operations use authenticated API routes rather than CI jobs:

- `/api/admin/sync-quests` - Sync quest definitions to Arkiv
- `/api/admin/rebuild-static` - Rebuild static data

This avoids duplicating Vercel environment variables in GitHub Actions. See [Vercel Integration](/docs/architecture/integrations/vercel-integration) for details.

---

## Implications for Contributors

### Opening a pull request

1. Create a branch and push changes
2. GitHub Actions runs automatically on the PR
3. All four jobs must be green (E2E is non-blocking but reviewed)
4. Vercel creates a preview deployment for manual testing
5. Review the PR with CI results and preview deployment

### What blocks a merge

- TypeScript errors (`pnpm typecheck`)
- Unit test failures (`pnpm test`)
- Build failures (`pnpm build`)
- Secret detection (security scan)
- Tracked files in `refs/` (security scan)

### What does not block a merge

- Prettier formatting warnings
- ESLint warnings (up to the `--max-warnings 1000` threshold)
- E2E test failures (transient external dependencies)

### Adding dependencies

When adding new dependencies:

1. Use `pnpm add <package>` (not npm or yarn)
2. The lockfile (`pnpm-lock.yaml`) will update automatically
3. Commit the updated lockfile alongside the code change
4. CI uses `--frozen-lockfile`, so a missing lockfile update will fail the install step

### Adding tests

- **Unit tests**: Place in `__tests__/` directories or alongside source files with `.test.ts` / `.spec.ts` extensions
- **E2E tests**: Place in `e2e/` directory with `.spec.ts` extension
- Vitest and Playwright have separate configurations and exclude lists; do not mix test frameworks

---

## Configuration Files

| File                       | Purpose                              |
| -------------------------- | ------------------------------------ |
| `.github/workflows/ci.yml` | GitHub Actions CI pipeline           |
| `vitest.config.ts`         | Unit test configuration and excludes |
| `playwright.config.ts`     | E2E test configuration               |
| `vercel.json`              | Vercel cron jobs                     |
| `.husky/pre-commit`        | Pre-commit hook (runs lint-staged)   |
| `.eslintrc.cjs`            | ESLint rules                         |
| `tsconfig.json`            | TypeScript configuration             |

---

## Related Documentation

- [Engineering Guidelines](/docs/philosophy/engineering-guidelines) - Pre-commit checklist and code quality standards
- [Developer Experience](/docs/practices/developer-experience) - DX runbook and code organization
- [Vercel Integration](/docs/architecture/integrations/vercel-integration) - Deployment infrastructure and environment variables
- [Architecture Overview](/docs/architecture/overview) - System architecture and technology stack

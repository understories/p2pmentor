# Contributing

Thank you for your interest in contributing to the Arkiv Next.js Starter template!

## Engineering Guidelines

This template follows strict Engineering Guidelines to ensure code quality and security. Please review:

- [Engineering Guidelines](./ENGINEERING_GUIDELINES.md) - Complete engineering standards

## Key Rules

Before contributing, ensure you understand:

1. **Build must pass** - `npm run build` and `npm run typecheck` must succeed
2. **No secrets** - Never commit private keys, API keys, or passwords
3. **No refs/** - Files in `refs/` are internal-only and must never be committed
4. **No whitespace-only changes** - Run `git diff --check` before committing

## Pre-Commit Checklist

Before committing, run:

```bash
npm run build
npm run typecheck
git diff --check
```

Or use the precommit script:

```bash
./scripts/precommit-check.sh
```

## Arkiv Patterns

This template demonstrates specific Arkiv patterns. When adding features:

- Follow patterns from `docs/patterns-used.md`
- Use Arkiv App Primitives (`arkiv-app-kit`) for common operations
- Ensure wallet normalization, query shapes, and timeout handling are correct

## Questions?

See the [README](../README.md) for more information about this template.


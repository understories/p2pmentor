## What

<!-- Brief description of changes -->

## Why

<!-- Motivation or linked issue -->
<!-- Reference: ENGINEERING_GUIDELINES.md - explain why, not what -->

## Testing

<!-- What was tested manually and/or by CI -->

- [ ] Build passes (`pnpm build`)
- [ ] Unit tests pass (`pnpm test`)
- [ ] E2E tests pass (`pnpm e2e`) - if applicable
- [ ] Manual testing completed for affected features

## Checklist

- [ ] Build passes (`pnpm build` succeeds) ⚠️ MANDATORY
- [ ] No secrets in code, commit messages, or documentation
- [ ] No hardcoded credentials as fallbacks
- [ ] Documentation updated if needed (public docs in `docs/`, not `refs/`)
- [ ] Code is clean (no commented code, unused imports, debug logs)
- [ ] Commit message is clear and doesn't mention secrets
- [ ] Wallet addresses normalized in Arkiv operations (if applicable)
- [ ] Error handling is graceful and defensive

## Notes

<!-- Any additional context, breaking changes, or follow-up work needed -->

# Next.js Template Skeleton

This is a minimal Next.js template skeleton that demonstrates how to use the Arkiv App Primitives (`@understories/arkiv-app-kit`) in a real application.

## What This Includes

- Next.js App Router setup
- Arkiv App Primitives integration (via workspace or copy-in)
- Basic project structure following Engineering Guidelines
- CI workflow from AI kit
- Precommit hooks from AI kit

## Usage

This template is referenced by the AI kit when scaffolding new Arkiv applications. It demonstrates:

1. How to integrate `arkiv-app-kit` (workspace, submodule, or copy-in)
2. How to structure an Arkiv app following patterns
3. How to enforce Engineering Guidelines via CI

## Integration with App-Kit

The app-kit is integrated via one of these methods:

- **Workspace monorepo:** `packages/arkiv-app-kit` (recommended for development)
- **Git submodule:** `packages/arkiv-app-kit` (recommended for production)
- **Copy-in:** `src/lib/arkiv-app-kit` (simplest, but requires manual updates)

See `arkiv-app-kit/README.md` for distribution strategies.


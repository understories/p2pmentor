# Arkiv Toolkits

**Authority:** If anything here conflicts with `arkiv/patterns/`, patterns are canonical.

> **⚠️ These are accelerators. They may lag behind current patterns. Patterns are canonical.**

This directory contains documentation for extracted templates and shared packages that will be published as standalone repositories for the broader Arkiv builder community.

**Non-authoritative:** Nothing here defines rules. These are optional starting points that assume specific patterns. Always verify against the [Patterns Catalog](../patterns/README.md).

## Contents

### [AI Agent Kit](./ai-agent-kit.md)

Drop-in LLM context for building Arkiv integrations correctly from day one. Provides prompts, scripts, and documentation designed to be used with AI coding tools (Cursor, Copilot, Claude, etc.).

**Status:** Available in `extractions/arkiv-ai-agent-kit/` (will be published as standalone repo)

**Key Features:**
- Enforces Engineering Guidelines via CI and precommit scripts
- Provides LLM-readable prompts covering all essential Arkiv patterns
- Prevents common mistakes through explicit anti-pattern callouts
- Testnet-native (Mendoza-focused) with clear operational guidance

### [Arkiv App Kit](./arkiv-app-primitives.md)

Composable building blocks for Arkiv integrations. Provides the "boring but essential" Arkiv plumbing that every app needs: wallet normalization, query builders, transaction timeouts, space ID management, and more.

**Status:** Available in `extractions/arkiv-app-kit/` (will be published as standalone package `@understories/arkiv-app-kit`)

**Key Features:**
- Fail-closed configuration (environment variables throw errors if missing)
- Pattern-aligned code (follows established patterns from Arkiv Patterns Catalog)
- Type-safe (full TypeScript with strict mode)
- Testnet-native (Mendoza-focused with local node support for CI)
- Composable design (primitives, not a framework)

### [Arkiv Next.js Starter](./arkiv-nextjs-starter.md)

Complete starter template for building Arkiv applications with Next.js. Demonstrates read paths, write paths, optimistic UI, and error handling in a working example.

**Status:** Available in `extractions/arkiv-nextjs-starter/` (will be published as standalone repo)

**Key Features:**
- Next.js App Router with server-signed writes (Phase 0)
- Optimistic UI with indexer lag handling
- Complete error handling (timeouts, rate limits, network errors)
- Testnet-native (Mendoza-focused with local node support for CI)
- Uses Arkiv App Kit for all Arkiv operations

---

## Related Documentation

- [Arkiv Patterns Catalog](../arkiv-patterns-catalog.md) - Comprehensive pattern documentation
- [Top 8 Patterns](../top-8-patterns.md) - Essential patterns demonstrated in templates
- [Engineering Guidelines](../../../ENGINEERING_GUIDELINES.md) - Complete engineering standards

## Navigation

- [Arkiv Patterns Catalog](../arkiv-patterns-catalog.md) - Main Arkiv patterns documentation

---

**Last Updated:** 2025-12-30


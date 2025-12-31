# Operations Documentation

**Authority:** If anything here conflicts with `arkiv/patterns/`, patterns are canonical.

**Purpose:** Operational documentation for how Arkiv integration runs in production, what breaks, and who fixes it.

**Audience:** Backend engineers, infrastructure engineers, app engineers, and code reviewers.

**Stability Note:** These docs may change faster than patterns. They reflect current operational reality, not long-term architecture.

## Why These Docs Are Operational

This folder contains documentation that answers:
- **How does this run in reality?** (environments, signers, rollouts)
- **What breaks and how?** (timeouts, indexer lag, transaction failures)
- **Who fixes it?** (debugging guides, verification procedures)
- **What's temporary?** (beta-only features, phase-0 patterns)

Unlike patterns (which are stable rules), operational docs reflect:
- Current deployment configuration
- Temporary workarounds
- Beta-specific constraints
- Migration states

## Documentation in This Folder

- **[Environments](./environments.md)** - Space ID configuration and environment isolation
- **[Central Signer Phase 0](./central-signer-phase0.md)** - Current server-signed write model (beta)
- **[Wallet Architecture](./wallet-architecture.md)** - Profile wallet vs signing wallet distinction
- **[Wallet Authentication Flow](./wallet-authentication-flow.md)** - User authentication implementation
- **[Profile Creation Flow](./profile-creation-flow.md)** - Profile creation sequence
- **[Entity Update Rollout](./entity-update-rollout.md)** - Migration from Pattern A to Pattern B
- **[SDK API Verification Guide](./sdk-api-verification-guide.md)** - SDK verification procedures
- **[Access Grants](./access-grants.md)** - Access control implementation (links to revocation patterns)
- **[Privacy Consent](./privacy-consent.md)** - Privacy consent state machine (links to revocation patterns)
- **[Invite Code System](./invite-code-system.md)** - Beta invite code implementation
- **[Implementation FAQ](./implementation-faq.md)** - Common questions and troubleshooting

## Link Hygiene

Operational docs should link to:
- **Patterns** for canonical rules (e.g., revocation patterns, marker entities)
- **Entities** for schema references
- **Not** to other operational docs for authority (they're descriptive, not normative)

## See Also

- **[Patterns](../patterns/README.md)** - Single source of truth for rules and invariants
- **[Entities](../entities/README.md)** - Entity schemas and specifications
- **[Overview](../overview/overview.md)** - Conceptual introduction to Arkiv


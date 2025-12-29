# Access Grants: Review Mode

Access grants are Arkiv entities that record temporary capabilities associated with a wallet. Instead of using server-side permissions or hidden flags, access is modeled as data on Arkiv.

## Overview

During beta, reviewers need to test specific flows without going through the normal onboarding process. Rather than adding special backend permissions or server-side logic, we use an access grant entity that lives on Arkiv.

The access grant pattern treats access as **data**, not configuration. Access state is stored on Arkiv, signed by the wallet, and readable by any client.

## How It Works

### Review Mode Activation Entity

When a reviewer activates review mode, their wallet publishes a `review_mode_activation` entity to Arkiv:

**Entity Type:** `review_mode_activation`

**Attributes:**
- `type`: `"review_mode_activation"`
- `typeVersion`: `"1"`
- `spaceId`: Beta space ID (same as user data)
- `wallet`: Normalized wallet address of the reviewer
- `mode`: `"arkiv_review"`
- `activatedAt`: ISO timestamp
- `expiresAt`: Optional ISO timestamp
- `appBuild`: Optional build identifier

**Signer:** User wallet (not server wallet)

**Query Pattern:**
```typescript
const query = publicClient.buildQuery()
  .where(eq('type', 'review_mode_activation'))
  .where(eq('wallet', walletAddress.toLowerCase()))
  .where(eq('spaceId', spaceId))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();
```

The app queries for the latest non-expired activation entity. If found, onboarding is skipped and the reviewer can create a profile directly.

### Flow

1. Reviewer connects wallet on auth page
2. Reviewer enters shared password (client-side SHA256 hash verification)
3. If password matches, wallet creates `review_mode_activation` entity on Arkiv
4. App queries Arkiv for activation entity
5. If activation exists and is not expired, redirect to review profile creation
6. After profile creation, reviewer behaves like any normal user

There is no separate "review account" or test space. Review activations live in the same beta space as user data.

## Why Use Access Grants

**Arkiv is the source of truth:** Access state lives where all other state lives, not in localStorage or server sessions.

**No server permissions:** The client queries Arkiv directly. No hidden backend logic needed to determine access.

**Portable:** Review state is visible on Arkiv Explorer and persists across devices.

**Verifiable:** Activation entities are signed by the wallet and can be verified independently.

**Protocol-aligned:** Capabilities are expressed as signed data entities, not implicit flags.

## Security Model (Beta)

Review mode uses a shared secret (password) during beta to control who can publish a review activation:

- Password is hashed client-side (SHA256)
- Hash is stored in public environment variable (`NEXT_PUBLIC_ARKIV_REVIEW_PASSWORD_SHA256`)
- Password verification is client-side only
- Actual activation requires creating an entity on Arkiv (signed by wallet)

This is intentionally lightweight for beta testing. It prevents accidental access without requiring servers or whitelists.

In production systems, access grants can be issued by trusted wallets or DAOs instead of shared passwords.

## Other Use Cases

The access grant pattern generalizes to other capabilities:

- Temporary roles (e.g., "event organizer" for a specific gathering)
- Feature previews (e.g., "beta tester" for new features)
- Event access (e.g., "conference attendee")
- Contributor permissions (e.g., "documentation editor")
- Capability-based UI changes (e.g., "admin mode")

All without special backend logic. Access becomes just another Arkiv entity type.

## Related Documentation

- [Wallet Architecture](/docs/arkiv/wallet-architecture) - Profile wallet vs. signing wallet
- [Central Signer Phase 0](/docs/arkiv/central-signer-phase0) - Current signing model
- [Profile Creation Flow](/docs/arkiv/profile-creation-flow) - How profiles are created


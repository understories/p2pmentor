# Access Grants: Review Mode

Access grants are Arkiv entities that encode capabilities. Instead of using server-side permissions or hidden flags, access is modeled as data on Arkiv.

## Overview

During beta, reviewers need to test specific flows without going through the normal onboarding process. Rather than storing permissions in server sessions or feature flags, we use an access grant entity that lives on Arkiv.

The access grant pattern treats access as **data**, not configuration. Access state is stored on Arkiv, signed by the issuer, and readable by any client.

## How It Works

### Review Mode Grant Entity

When a reviewer requests review mode access, the app server issues a `review_mode_grant` entity on Arkiv:

**Entity Type:** `review_mode_grant`

**Attributes:**
- `type`: `"review_mode_grant"`
- `typeVersion`: `"1"`
- `space_id`: Beta space ID (same as user data)
- `subject_wallet`: Normalized wallet address of the reviewer
- `mode`: `"arkiv_review"`
- `issued_at`: ISO timestamp
- `expires_at`: Optional ISO timestamp (defaults to 7 days)
- `issuer_wallet`: Server signer wallet address (required for verification)
- `reason`: Optional (e.g., `"arkiv_team_review"`)
- `app_build`: Optional build identifier

**Signer:** App server signer wallet (ARKIV_PRIVATE_KEY)

**Query Pattern:**
```typescript
const query = publicClient.buildQuery()
  .where(eq('type', 'review_mode_grant'))
  .where(eq('subject_wallet', walletAddress.toLowerCase()))
  .where(eq('space_id', spaceId))
  .withAttributes(true)
  .withPayload(true)
  .limit(100)
  .fetch();

// Client must verify issuer_wallet matches server signer address
// This prevents user-issued grants from being recognized
```

**Note:** In the current implementation, the client trusts the API response and proceeds immediately after grant issuance. The grant entity is still created on Arkiv and can be queried later for verification/audit purposes, but the client does not wait for it to be queryable before proceeding. This avoids Arkiv indexing delays while maintaining the Arkiv-native pattern.

### Flow

1. Reviewer connects wallet on auth page
2. Reviewer selects "Arkiv Review Mode" option
3. Reviewer enters shared password (client-side SHA256 hash verification)
4. If password matches, client calls API route to issue grant
5. Server issues `review_mode_grant` entity (signed by app signer)
6. **Client trusts API response and proceeds immediately** (no waiting for Arkiv indexing)
7. Wallet stored in `localStorage` (same pattern as regular flow)
8. Route to `/review` page immediately
9. Review page uses bypass pattern (similar to onboarding bypass) - allows access without grant querying
10. After profile creation, reviewer behaves like any normal user

**Note:** The grant entity is still created on Arkiv for auditability and verification. However, the client trusts the API response and proceeds immediately rather than waiting for the grant to be queryable on Arkiv. This avoids indexing delays while maintaining the Arkiv-native pattern of storing access as data.

There is no separate "review account" or test space. Review grants live in the same beta space as user data.

## Why Use Access Grants

**Arkiv is the source of truth:** Access state lives where all other state lives, not in localStorage or server sessions.

**Issuer verification:** Grants are signed by the app signer wallet, and clients verify `issuer_wallet` to prevent user-issued grants.

**Portable:** Review state is visible on Arkiv Explorer and persists across devices.

**Verifiable:** Grant entities are signed by the issuer and can be verified independently.

**Protocol-aligned:** Capabilities are expressed as signed data entities, not implicit flags.

## Security Model (Beta)

Review mode uses a shared secret to reduce accidental use during beta. This is intentionally lightweight and is not a production authorization system.

- The reviewer enters a password in the UI.
- The client hashes the typed password with SHA256 and compares it to a build-time public hash (`NEXT_PUBLIC_ARKIV_REVIEW_PASSWORD_SHA256`).
- The hash is public; hashing is used to avoid shipping a plaintext password in the client bundle, not to provide strong secrecy.
- If the password check passes, the client requests grant issuance from the app.
- The app signer issues the `review_mode_grant` entity on Arkiv.
- **Client trusts API response and proceeds immediately** (no waiting for grant indexing).
- Review page uses bypass pattern (similar to onboarding bypass) stored in `sessionStorage`.
- Grant entity can be queried later for verification/audit (clients verify `issuer_wallet` matches server signer address).

This design keeps the capability itself Arkiv-native (expressed as signed Arkiv data) while keeping beta gating simple and operationally low-friction. The bypass pattern allows immediate access while the grant entity is still being indexed on Arkiv.

## Alternative Patterns

The access grant pattern can also be implemented with wallet-signed activations:

- User wallet signs the activation entity
- No server signer required
- Client verifies signature instead of issuer address

For this beta, we use app-signed grants because:
- Matches existing central signer architecture
- Server signer is always available
- Consistent with other entity creation patterns

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

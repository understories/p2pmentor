# Review UI: Developer Testing Interface

The Review UI (also called "Developer UI") is a simplified, barebones interface for testing Arkiv functionality. It provides a streamlined way to audit and verify that all core Arkiv operations work correctly, without the complexity of the full user-facing product.

## Overview

The Review UI is a separate interface accessible to authorized reviewers. It allows step-by-step testing of all core Arkiv functionality:

1. Profile creation and updates
2. Skills management (add, remove, edit)
3. Availability management (create, delete)
4. Asks creation (learning requests)
5. Offers creation (teaching offers, free and paid)
6. Network exploration

Each step creates or modifies Arkiv entities and immediately displays entity information (entity key, transaction hash) with links to Arkiv Explorer for verification.

## Purpose

The Review UI serves several purposes:

- **Functionality Audits**: Verify that all Arkiv operations work correctly
- **Entity Verification**: Immediately see entity keys and transaction hashes after operations
- **Simplified Testing**: Test core functionality without navigating complex user flows
- **Arkiv-Native Verification**: All operations use the same Arkiv patterns as the main application

## Access Control

The Review UI is gated using the [Access Grants pattern](./access-grants.md). Access is controlled through:

1. **Password Verification**: Client-side password verification (SHA-256 hash comparison)
2. **Access Grant Entity**: Server issues a `review_mode_grant` entity on Arkiv
3. **Session Bypass**: Uses `sessionStorage` to bypass grant verification during the session

### Authentication Flow

1. User enables "Arkiv Review Mode" toggle on the `/auth` page
2. User enters review password
3. Password is verified client-side (SHA-256 hash comparison)
4. User connects wallet (MetaMask or WalletConnect)
5. Server issues `review_mode_grant` entity on Arkiv
6. Client stores wallet and sets session bypass flag
7. User is routed to `/review` page

**Note**: The client trusts the API response and proceeds immediately after grant issuance. The grant entity is still created on Arkiv for auditability, but the client does not wait for it to be queryable before proceeding. This avoids Arkiv indexing delays while maintaining the Arkiv-native pattern.

For detailed information about the access grant pattern, see [Access Grants: Review Mode](./access-grants.md).

## Architecture

### Two-Wallet System

The Review UI follows the same [two-wallet architecture](./wallet-architecture.md) as the main application:

- **Profile Wallet**: User's MetaMask or WalletConnect wallet (no funds needed)
  - Used as the `wallet` attribute on entities
  - Identifies the entity owner
  - Stored in `localStorage` as `wallet_address`

- **Signing Wallet**: Server-side wallet (private key in environment variables)
  - Signs all Arkiv transactions
  - Uses `ARKIV_PRIVATE_KEY` environment variable
  - Requires testnet tokens for transaction fees

All entity creation and updates are signed by the server signing wallet, not the user's profile wallet. The profile wallet is only used to identify the entity owner.

### Code Reuse

The Review UI does not reinvent functionality. Instead, it:

- Reuses existing API routes (`/api/profile`, `/api/availability`, `/api/asks`, `/api/offers`)
- Reuses existing components (`SkillSelector`, `WeeklyAvailabilityEditor`)
- Reuses existing library functions (`getProfileByWallet`, `listSkills`, `listAvailabilityForWallet`)
- Repackages existing functionality in a simplified UI

This ensures that testing the Review UI verifies the same code paths used by the main application.

## Review UI Steps

### 1. Profile Creation

**Location**: `/review` page, Profile step

**Functionality**:
- Create new profile with required fields (displayName, username, bio, timezone)
- Edit existing profile
- Real-time username verification (prevents duplicates)
- Immediate entity information display after creation

**Entity Created**: `user_profile` entity on Arkiv

**Entity Information Displayed**:
- Entity key
- Transaction hash
- "View on Arkiv Explorer" link

**Related Documentation**:
- [Profile Creation Flow](./profile-creation-flow.md)
- [Profile Entity](./profile.md)
- [Stable Entity Key Updates](./patterns/stable-entity-key-updates.md)

### 2. Skills Management

**Location**: `/review` page, Skills step

**Functionality**:
- Add skills to profile (using `SkillSelector` component)
- Remove skills from profile
- Skills stored in profile entity's `skillsArray` attribute
- Immediate entity information display after update

**Entity Updated**: `user_profile` entity (stable entity key)

**Entity Information Displayed**:
- Entity key
- Transaction hash
- "View on Arkiv Explorer" link

**Related Documentation**:
- [Skill Entity](./skill.md)
- [Stable Entity Key Updates](./patterns/stable-entity-key-updates.md)

### 3. Availability Management

**Location**: `/review` page, Availability step

**Functionality**:
- Create availability blocks (using `WeeklyAvailabilityEditor` component)
- Delete availability blocks
- Each availability block is a separate entity on Arkiv
- Immediate entity information display after creation

**Entity Created**: `availability` entity on Arkiv

**Entity Information Displayed**:
- Entity key
- Transaction hash
- "View on Arkiv Explorer" link

**Related Documentation**:
- [Availability Entity](./availability.md)
- [Deletion Patterns](./patterns/deletion-patterns.md)

### 4. Asks Creation

**Location**: `/review` page, Asks step

**Functionality**:
- Create learning requests (asks)
- Skill selection (using `SkillSelector` component)
- TTL/expiration support (24h, 1 week, 1 month, custom)
- Immediate entity information display after creation

**Entity Created**: `ask` entity on Arkiv

**Entity Information Displayed**:
- Entity key
- Transaction hash
- "View on Arkiv Explorer" link

**Related Documentation**:
- [Ask Entity](./ask.md)
- [TTL/Expiration Handling](./ask.md#ttlexpiration-handling)

### 5. Offers Creation

**Location**: `/review` page, Offers step

**Functionality**:
- Create teaching offers
- Support for free and paid offers
- Payment details (cost, payment address) for paid offers
- Skill selection (using `SkillSelector` component)
- TTL/expiration support (24h, 1 week, 1 month, custom)
- Immediate entity information display after creation

**Entity Created**: `offer` entity on Arkiv

**Entity Information Displayed**:
- Entity key
- Transaction hash
- "View on Arkiv Explorer" link

**Related Documentation**:
- [Offer Entity](./offer.md)
- [Free vs Paid Offer Handling](./offer.md#free-vs-paid-offer-handling)
- [TTL/Expiration Handling](./offer.md#ttlexpiration-handling)

### 6. Network Exploration

**Location**: Link to `/network` page

**Functionality**:
- Browse all asks and offers in the network
- Filter by skill or type
- View entity details

**Related Documentation**:
- [Network Feed & Discovery](./ask.md#network-feed--discovery)

## Entity Information Display

After each entity creation or update, the Review UI displays:

1. **Success Message**: Confirmation that the operation succeeded
2. **Entity Key**: The Arkiv entity key (used for queries and relationships)
3. **Transaction Hash**: The blockchain transaction hash
4. **View on Arkiv Explorer Link**: Direct link to view the entity on Arkiv Explorer

This immediate feedback allows reviewers to:
- Verify that entities were created correctly
- Check entity data on Arkiv Explorer
- Debug any issues with entity creation
- Understand the Arkiv-native data model

## Implementation Details

### Page Location

The Review UI is accessible at `/review` after authentication.

### Authentication

Authentication is handled on the `/auth` page:
- Review mode toggle enables password verification
- Password verification must complete before wallet connection
- Wallet connection triggers grant issuance
- Grant issuance routes to `/review` page

### Session Management

The Review UI uses `sessionStorage` to maintain access during the session:
- `review_mode_bypass`: Flag indicating review mode access is granted
- Cleared on page refresh or session end
- Allows access to `/review` page without re-verifying grant

### Error Handling

All steps include error handling:
- Form validation before submission
- API error messages displayed to user
- Network errors handled gracefully
- Entity creation failures show clear error messages

## Related Patterns

The Review UI demonstrates and uses several key Arkiv patterns:

- **[Access Grants](./access-grants.md)**: Gated access using Arkiv entities
- **[Stable Entity Key Updates](./patterns/stable-entity-key-updates.md)**: Profile updates reuse same entity key
- **[Deletion Patterns](./patterns/deletion-patterns.md)**: Availability deletion uses marker entities
- **[Wallet Normalization](./patterns/wallet-normalization.md)**: All wallet addresses normalized to lowercase
- **[TTL/Expiration](./ask.md#ttlexpiration-handling)**: Asks and offers use TTL for automatic expiration
- **[Two-Wallet Architecture](./wallet-architecture.md)**: Profile wallet vs signing wallet separation

## Testing Workflow

A typical testing workflow using the Review UI:

1. **Enable Review Mode**: Toggle on `/auth` page, verify password, connect wallet
2. **Create Profile**: Fill in required fields, verify entity creation
3. **Add Skills**: Add one or more skills, verify profile update
4. **Set Availability**: Create availability block, verify entity creation
5. **Create Ask**: Post a learning request, verify entity creation
6. **Create Offer**: Post a teaching offer (free or paid), verify entity creation
7. **Verify on Arkiv Explorer**: Click "View on Arkiv Explorer" links to verify entity data

Each step can be repeated multiple times to test different scenarios.

## Security Considerations

- **Password Protection**: Review mode requires password verification
- **Access Grants**: Access is gated by Arkiv entities, not server sessions
- **Server Signing**: All transactions signed by server wallet (prevents user wallet fund requirements)
- **Session-Based Bypass**: Bypass flag stored in `sessionStorage` (cleared on refresh)
- **No Secrets in Code**: Password hash stored in public environment variable (client-side verification only)

## Future Enhancements

Potential future enhancements to the Review UI:

- **Entity Query Interface**: Direct query interface for testing Arkiv queries
- **Bulk Operations**: Create multiple entities at once for load testing
- **Entity History View**: View all versions of an entity (for versioned entities)
- **Query Performance Metrics**: Display query timing and performance data
- **Entity Relationship Visualization**: Visualize relationships between entities

## Related Documentation

- [Access Grants: Review Mode](./access-grants.md)
- [Wallet Architecture](./wallet-architecture.md)
- [Profile Entity](./profile.md)
- [Skill Entity](./skill.md)
- [Availability Entity](./availability.md)
- [Ask Entity](./ask.md)
- [Offer Entity](./offer.md)
- [Top 8 Arkiv Patterns](./top-8-patterns.md)
- [Arkiv Patterns Catalog](./arkiv-patterns-catalog.md)


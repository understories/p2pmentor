# Lite Version

## Overview

The Lite Version is a simplified, no-authentication version of p2pmentor available at `/lite`. It provides a streamlined ask/offer board where anyone can post learning requests (asks) or teaching offers without creating an account or connecting a wallet.

## Background

The Lite Version was developed for the January 2026 cohort of the Network School, whose communications happen on Discord. This context explains key design decisions:

- **Discord handles as required fields**: Since the cohort uses Discord for communication, Discord handles are required for both asks and offers, enabling direct contact between matched participants
- **Discord-based matching logic**: Matches ensure Discord handles are different to prevent self-matching, and matched participants can connect directly via Discord
- **No authentication required**: Designed for quick, low-friction participation without wallet setup or account creation

## Purpose

The Lite Version is designed for:
- **Quick deployment**: Minimal setup, no authentication required
- **Low friction**: Users can post asks and offers immediately
- **Simple matching**: Basic skill-based matching without complex features
- **Public board**: All asks and offers are visible to everyone

## Key Features

### No Authentication Required

- No login UI
- No user profiles
- No wallet connection
- All data is stored on Arkiv using an app-wide wallet (stored as an environment variable)

### Ask/Offer Board

Users can:
- **Create Asks**: Post what they want to learn
- **Create Offers**: Post what they can teach
- **View Matches**: See automatically matched asks and offers

All functionality is available on a single page.

### Matching

Matches are automatically computed when:
- An ask and offer have the same skill/topic (case-insensitive)
- The Discord handles are different (prevents self-matching)

Matches are displayed on the same page as asks and offers. Since the Lite Version was designed for Discord-based communities (specifically the January Network School cohort), matched participants can connect directly via Discord using the provided handles.

## Entity Structure

### Lite Ask Entity

**Type:** `lite_ask`

**Attributes:**
- `type`: `'lite_ask'`
- `name`: User's name (required, max 100 characters)
- `discordHandle`: Discord handle (required, max 50 characters, normalized to lowercase)
- `skill`: Skill/topic name (required, simple string, max 200 characters)
- `spaceId`: User-selectable (defaults: `'nsjan26'`, `'test'`; users can create additional spaceIds)
- `createdAt`: ISO timestamp
- `status`: `'open'`
- `ttlSeconds`: `'2592000'` (1 month)

**Payload:**
- `description`: Optional description (max 1000 characters)

### Lite Offer Entity

**Type:** `lite_offer`

**Attributes:**
- `type`: `'lite_offer'`
- `name`: User's name (required, max 100 characters)
- `discordHandle`: Discord handle (required, max 50 characters, normalized to lowercase)
- `skill`: Skill/topic name (required, simple string, max 200 characters)
- `cost`: Optional cost information (max 50 characters, offers only)
- `spaceId`: User-selectable (defaults: `'nsjan26'`, `'test'`; users can create additional spaceIds)
- `createdAt`: ISO timestamp
- `status`: `'active'`
- `ttlSeconds`: `'2592000'` (1 month)

**Payload:**
- `description`: Optional description (max 1000 characters)

## Time to Live (TTL)

All asks and offers have a fixed TTL of **1 month** (2,592,000 seconds). This keeps the board fresh and automatically removes expired posts.

## Data Storage

All data is stored on the Arkiv network:
- Data is visible and verifiable on the Arkiv explorer
- All transactions are signed by an app-wide wallet (stored as an environment variable)
- Data is NOT private (until encrypted data is implemented)
- Space ID is user-selectable (defaults: `'nsjan26'`, `'test'`; users can create additional spaceIds) for data isolation and testing

## Differences from Main App

| Feature | Main App | Lite Version |
|---------|----------|--------------|
| Authentication | Required (wallet) | None |
| User Profiles | Yes | No |
| Skill Entities | Yes (structured) | No (simple strings) |
| Meeting Requests | Yes | No |
| Session Creation | Yes | No |
| TTL Selection | Customizable | Fixed (1 month) |
| Wallet Addresses | User wallets | App-wide wallet (env var) |
| Discord Handles | Optional | Required |

## User Experience

### Creating an Ask

1. Fill in required fields:
   - Name (max 100 characters)
   - Discord handle (max 50 characters)
   - Skill/topic (max 200 characters)
2. Optionally add a description (max 1000 characters)
3. Submit - the ask is immediately posted to the board

### Creating an Offer

1. Fill in required fields:
   - Name (max 100 characters)
   - Discord handle (max 50 characters)
   - Skill/topic (max 200 characters)
2. Optionally add:
   - Description (max 1000 characters)
   - Cost information (max 50 characters)
3. Submit - the offer is immediately posted to the board

### Viewing Matches

Matches are automatically computed and displayed when:
- An ask and offer share the same skill/topic
- The Discord handles are different

Users can see matched pairs and contact each other directly via Discord using the provided handles. This design reflects the Lite Version's origin as a tool for Discord-based learning communities.

## Technical Implementation

### App-Wide Wallet

All entity creation uses an app-wide wallet stored as an environment variable (`ARKIV_PRIVATE_KEY`):
- No user wallet addresses required
- All transactions signed by the app-wide operational signer
- Simplifies the user experience
- Consistent with p2pmentor's serverless architecture (no private database required)

### Space Isolation

The lite page includes a spaceId selector with default options (`'nsjan26'`, `'test'`) and the ability to create additional spaceIds:
- Users can select from existing spaceIds or create new ones for data isolation
- Default `'nsjan26'` is used for production data (January 2026 Network School cohort)
- `'test'` option enables testing without affecting production data
- Users can create additional spaceIds dynamically for different communities/cohorts
- All queries and entity creation use the selected spaceId
- Changing spaceId reloads all data from the selected space
- SpaceIds are persisted in browser localStorage

### Matching Logic

Matching is computed client-side:
- Compares skill/topic (case-insensitive, trimmed)
- Ensures Discord handles are different
- Simple, transparent matching algorithm

## Input Validation

All form inputs have maximum length limits to prevent truncation:
- Name: 100 characters
- Discord handle: 50 characters
- Skill/topic: 200 characters
- Description: 1000 characters
- Cost: 50 characters (offers only)

## Future Considerations

- Encrypted data for privacy
- Server-side matching (currently client-side)
- Additional matching criteria
- Integration with main app features

## Related Documentation

- [Asks and Offers](./asks-offers.md) - Main app ask/offer system
- [Serverless & Verifiable by Design](../philosophy/serverless-and-trustless.md) - Architecture philosophy
- [Arkiv Integration](../architecture/arkiv-integration.md) - Arkiv network details
- [Space Isolation](../arkiv/patterns/space-isolation.md) - Space ID patterns


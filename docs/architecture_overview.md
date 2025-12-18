# Architecture Overview

This document describes the architecture and structural decisions for p2pmentor beta.

## Project Structure

```
/app                    # Next.js App Router routes
  /beta                 # Invite gate page
  /auth                 # Authentication pages
  /me                   # User dashboard
    /profile            # Profile management
    /skills             # Skills management
    /availability       # Availability management
    /sessions           # Session history
  /asks                 # Browse/create asks
  /offers               # Browse/create offers
  /network              # Network graph view
    /[profileId]        # Individual profile view
  /notifications        # Notifications center

/lib
  /arkiv                # Arkiv integration layer
    client.ts           # Arkiv SDK initialization
    /entities           # Entity schemas (JSON)
      profile.json
      skill.json
      ask.json
      offer.json
      session.json
      feedback.json
    profile.ts          # Profile CRUD helpers
    skills.ts           # Skills CRUD helpers
    asks.ts             # Asks CRUD helpers
    offers.ts           # Offers CRUD helpers
    sessions.ts         # Sessions CRUD helpers
    matches.ts          # Matching logic
  /auth                 # Authentication utilities
    metamask.ts         # MetaMask connection
    passkey.ts          # Ethereum passkey auth
  jitsi.ts              # Jitsi room generation
  payments.ts           # Payment/tx hash handling
  types.ts              # Shared TypeScript types

/components
  /layout               # App shell and navigation
  /ui                   # Basic UI components (buttons, inputs, cards)
  /forms                # Form components
    ProfileForm.tsx
    SkillsForm.tsx
    AvailabilityForm.tsx
    AskForm.tsx
    OfferForm.tsx
    SessionForm.tsx
    FeedbackForm.tsx
  /network              # Network view components
  /notifications        # Notification components

/docs
  beta_launch_sprint.md # Sprint specification
  architecture_overview.md # This file
  dx_arkiv_runbook.md   # Arkiv DX tracking
```

## Technology Stack

- **Framework**: Next.js 15+ (App Router)
- **Language**: TypeScript
- **Data Layer**: Arkiv Network (Mendoza testnet)
- **Authentication**: MetaMask + Ethereum Passkeys
- **Video**: Jitsi (with optional Livepeer/LiveKit)
- **Package Manager**: pnpm (preferred) or yarn

## Key Architectural Decisions

### 1. Arkiv Integration

- **Client-side**: Uses `@arkiv-network/sdk` with MetaMask wallet client
- **Server-side**: Uses private key for server-side entity creation (API routes)
- **Chain**: Mendoza testnet (Arkiv testnet)
- **Entities**: Immutable - updates create new entities

### 2. Authentication

- **Primary**: MetaMask wallet connection
- **Secondary**: Ethereum Passkey login (WebAuthn-based)
- **State Management**: Wallet address stored in session/cookies
- **Safety**: All UI includes warnings about testnet-only usage

### 3. Data Flow

1. User connects wallet → gets wallet address
2. Profile queries filtered by wallet address
3. All writes require wallet signature (client-side) or private key (server-side)
4. Reads use public client (no authentication required)

### 4. UI/UX Patterns

- **Mobile-first**: Responsive design starting from mobile breakpoints
- **Component Library**: Reused from `refs/hidden-garden-ui-ux-upgrades`
- **Design System**: Dark forest / hidden garden aesthetics

## Environment Variables

See `.env.example` for complete list with setup instructions. Key variables:

- `ARKIV_PRIVATE_KEY`: Private key for server-side operations (optional for client-only)
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`: WalletConnect Cloud project ID (see `.env.example` for setup instructions)
- `NEXT_PUBLIC_WALLETCONNECT_ENABLED`: Enable WalletConnect button (`true`/`false`)
- `JITSI_BASE_URL`: Jitsi instance URL (defaults to https://meet.jit.si)
- `NEXT_PUBLIC_*`: Public variables accessible in browser

**For Vercel deployment:** Set all environment variables in Vercel dashboard (Settings → Environment Variables).

## Code Reuse Strategy

This project extends and adapts code from:

- `refs/mentor-graph`: Core Arkiv integration patterns, entity schemas
- `refs/hidden-garden`: UI components and design patterns
- `refs/hidden-garden-ui-ux-upgrades`: Modern UI components
- `refs/passkey-oneshot-*`: Passkey authentication patterns

All reused code is adapted with:
- Proper attribution in comments
- License compliance
- Long-term resilience improvements

## Development Workflow

1. **Local Development**: `pnpm dev` runs Next.js dev server
2. **DX Tracking**: All Arkiv interactions logged in `docs/dx_arkiv_runbook.md`
3. **Architecture Updates**: This file updated when structural decisions change
4. **Sprint Progress**: Tracked in `docs/beta_launch_sprint.md` Sprint Checklist

## Future Considerations

- Migration to production Arkiv network (when available)
- Livepeer/LiveKit integration for enhanced video
- x402 payment hooks integration
- Indexer integration for faster queries
- Subscription-based real-time updates



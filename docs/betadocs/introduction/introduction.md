# Introduction

## Serverless, No Central Database

p2pmentor is a serverless application with no central database. All user data lives on Arkiv, a decentralized blockchain network. When you create a profile, it's stored as an entity on Arkiv. When you view your profile, we read it from Arkiv. We're just a client that helps you interact with the blockchain. The data lives on Arkiv, not on our servers.

**What this means:**
- Users own their data. It's stored on the blockchain with their wallet address.
- No trust required. The blockchain provides cryptographic proof that data exists and hasn't been tampered with.
- No single point of failure. Even if we disappear, your data remains accessible on Arkiv.
- Verifiable. Anyone can verify data independently using the Arkiv explorer.

**What we still need servers for:**
- Serving the web app (Next.js frontend)
- API routes that help format data (GraphQL wrapper)
- Video calls (Jitsi integration)

**What we don't need servers for:**
- Storing user data (Arkiv does this)
- Storing profiles, sessions, asks, offers (all on Arkiv)
- Data backups (Arkiv network handles this)
- Data verification (blockchain provides this)

## What p2pmentor is

A focused beta of a peer to peer mentorship network built on Arkiv so that user data lives on a shared, user-owned data layer. This is the first live step from Mentor Graph prototypes toward a broader Mentor Garden ecosystem, designed for small, high trust cohorts rather than public internet scale.

## Core Principles

**Data sovereignty**
Users own and control their data. The application is a client of a shared data layer, not the owner of data.

**No intermediaries in the core value flow**
The platform helps people find each other and coordinate. It does not sit in the middle as the primary owner of identity, content or relationships.

**Trustless infrastructure, trustworthy UX**
Infrastructure should not require trust to protect user data. UX and community norms should encourage good behavior and mutual respect.

## What p2pmentor is not

- Not production ready for mainnet or real funds
- Not a full mentorship marketplace or all-in-one learning platform
- Not a custodial SaaS product with a central application database
- Not an analytics-first product. Priority is trust and sovereignty, then optimized performance.

## Goals for the beta

- Validate core mentorship flows end to end
  - Create profile
  - Publish asks and offers
  - Match and schedule sessions
  - Join a call and reflect
- Validate Arkiv as the primary data layer for a real product
  - Only store what is needed off-chain (for performance or UX)
  - Make it easy for other builders to reuse our patterns and packages
- Collect structured feedback from both users and developers

## Audience

- Builders using Arkiv who want a concrete reference implementation
- Designers and PMs working on peer to peer mentorship flows
- Early mentors and learners testing the beta

## Documentation Structure

- Concept first (why), then architecture (how), then feature walkthrough (what it does)
- Arkiv-specific details collected in dedicated sections for reuse
- Beta documentation for an invite-only release
- Assumes readers are comfortable with web3 basics and TypeScript

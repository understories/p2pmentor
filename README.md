# p2pmentor

Planting the first beta seed of peer to peer mentorship.

Teach, learn, and mentor without intermediaries.  
Own your data.  
Let knowledge and growth light the path through the dark forest.

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

## What this project is

A small, focused beta of a peer to peer mentorship network.  
Built on Arkiv so users can own their data.  
Designed with the dark forest and hidden garden aesthetics from our earlier work.

## Core Principles

**Data sovereignty**
Users own and control their data. The application is a client of a shared data layer, not the owner of data.

**No intermediaries in the core value flow**
The platform helps people find each other and coordinate. It does not sit in the middle as the primary owner of identity, content or relationships.

**Trustless infrastructure, trustworthy UX**
Infrastructure should not require trust to protect user data. UX and community norms should encourage good behavior and mutual respect.

## What this project is not

Production ready.  
A place to use wallets with real funds.  
A full version of a mentorship platform.

## Development notes

Developer experience updates for Arkiv live in `/docs/dx_arkiv_runbook.md`.  
This beta is intentionally small so we can ship quickly and learn from real usage.

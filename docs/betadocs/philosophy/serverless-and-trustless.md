# Serverless & Trustless

## How does an app work without a central database?

Instead of storing data in our own database, we store everything on Arkiv, a decentralized blockchain network. Think of it like this:

**Traditional app:**
- User creates profile → stored in our database
- User creates session → stored in our database
- We control the data, we can delete it, we can change it

**p2pmentor:**
- User creates profile → stored as an entity on Arkiv blockchain
- User creates session → stored as an entity on Arkiv blockchain
- We don't control the data, users do. It's permanent and verifiable.

When you create a profile, we write it to Arkiv. When you view your profile, we read it from Arkiv. We're just a client that helps you interact with the blockchain. The data lives on Arkiv, not on our servers.

## Why would we not want a central server?

**Single point of failure**
If our server goes down, the app breaks. If our database gets corrupted, data is lost. If we shut down, all user data disappears. With Arkiv, the data lives on a decentralized network. Even if we disappear, your data remains accessible.

**Trust requirement**
With a central server, users must trust us to:
- Not delete their data
- Not sell their data
- Not change their data
- Keep the service running
- Protect their data from hackers

With Arkiv, users don't need to trust us. The blockchain provides cryptographic proof that data exists and hasn't been tampered with. Anyone can verify it independently.

**Data ownership**
With a central server, we own the data. Users are just borrowing it. With Arkiv, users own their data. It's stored on the blockchain with their wallet address. They can access it from any app that reads from Arkiv, not just ours.

**Censorship resistance**
A central server can be censored, blocked, or shut down. A decentralized blockchain network is much harder to censor. As long as the network exists, the data is accessible.

## How Arkiv enables serverless and trustless development from day 1

**Serverless means no backend database**
Arkiv IS the database. We don't need to set up PostgreSQL, MongoDB, or any other database. We don't need to manage database servers, backups, or migrations. Arkiv handles all of that.

**Trustless means no trust required**
Arkiv uses blockchain technology to provide cryptographic proof of data existence. Users can verify their data independently using the Arkiv explorer. They don't need to trust us or any central authority.

**From day 1 means it's built in**
Unlike traditional apps that start centralized and try to decentralize later, p2pmentor was built serverless and trustless from the beginning. Every entity is stored on Arkiv. Every query reads from Arkiv. There's no migration path needed because there's no central database to migrate from.

**What we still need servers for**
We still run servers, but only for:
- Serving the web app (Next.js frontend)
- API routes that help format data (GraphQL wrapper)
- Video calls (Jitsi integration)

But we don't need servers for:
- Storing user data (Arkiv does this)
- Storing profiles, sessions, asks, offers (all on Arkiv)
- Data backups (Arkiv network handles this)
- Data verification (blockchain provides this)

**The result**
A simpler architecture. Less infrastructure to manage. More resilient to failures. Users own their data. No trust required. All from day 1, not as an afterthought.


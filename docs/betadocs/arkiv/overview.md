# What is Arkiv?

**Arkiv** is a decentralized blockchain network that serves as the primary data storage layer for p2pmentor. Instead of using a traditional database, all data in p2pmentor is stored as **immutable entities** on the Arkiv blockchain. <a href="https://arkiv.network/docs" target="_blank" rel="noopener noreferrer">Read Arkiv's official documentation here.</a>

## For Everyone: Why This Matters

### You Own Your Data
When you create a profile, post an ask or offer, or schedule a session on p2pmentor, that information is stored on the Arkiv blockchain. This means:
- **You control your data** - it's not locked in a company's database
- **Your data persists** - even if p2pmentor disappears, your data remains on Arkiv
- **It's verifiable** - anyone can verify your data exists using the [Arkiv Explorer](http://explorer.mendoza.hoodi.arkiv.network/)

### Transparency and Trust
All data on Arkiv is **public and verifiable**. You can:
- View your own data on the [Arkiv Explorer](http://explorer.mendoza.hoodi.arkiv.network/)
- See how p2pmentor uses your data in our [p2pmentor Explorer](/explorer)
- Verify that what you see in the app matches what's on the blockchain

### No Central Server
Traditional apps store data in databases controlled by the company. Arkiv eliminates this:
- **No database to hack** - data is distributed across the blockchain
- **No single point of failure** - the network is resilient
- **Serverless** - p2pmentor doesn't need to manage database infrastructure

## For Technical Folks: How It Works

### Entity-Centric Model
All data in p2pmentor is stored as **entities** on Arkiv. Each entity consists of:
- **Attributes**: Indexed key-value pairs for querying (e.g., `type`, `wallet`, `spaceId`)
- **Payload**: JSON data stored in the entity body
- **Entity Key**: Unique identifier for the entity
- **Transaction Hash**: Blockchain transaction that created the entity

### Immutability with Mutable State
Arkiv transactions are **immutable** - once created, they cannot be modified. However, application data can be updated:
1. Use `updateEntity()` to create a new transaction that updates an existing entity
2. All transaction history is preserved on-chain (complete audit trail)
3. The application displays the latest canonical state derived from transactions

This provides a complete audit trail while allowing editable application data.

### Wallet-Based Identity
User identity is tied to **wallet addresses**:
- Wallet address is the primary identifier (normalized to lowercase)
- No user accounts or passwords required
- Users sign transactions with their wallet (MetaMask or Passkey)

### Space ID for Data Isolation
All entities include a `spaceId` attribute, which enables:
- **Multi-tenant data isolation** - different environments or app versions can use different space IDs
- **Testing environments** - separate test data from production data
- **Data organization** - group related entities together

## Key Benefits

1. **Serverless**: No database servers to manage
2. **Trustless**: Cryptographic proof of data existence
3. **Data Ownership**: Users own their data on-chain
4. **Resilience**: Data persists even if application disappears
5. **Verifiability**: Anyone can verify data on Arkiv explorer
6. **Audit Trail**: Complete history of all changes

## Explore Your Data

- **[Arkiv Explorer](http://explorer.mendoza.hoodi.arkiv.network/)** - View all data on the Arkiv blockchain
- **[p2pmentor Explorer](/explorer)** - See how p2pmentor structures and uses Arkiv data

## Learn More

For technical implementation details, see:
- **[Arkiv Overview (Technical)](/docs/arkiv/overview/overview)** - Detailed technical documentation
- **[Arkiv Patterns](/docs/arkiv/patterns/pattern-catalog)** - Essential patterns for building on Arkiv
- **[Entity Overview](/docs/arkiv/overview/entity-overview)** - Complete entity schemas


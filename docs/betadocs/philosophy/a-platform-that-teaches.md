# A Platform That Teaches

p2pmentor is designed to teach blockchain technology and philosophy through its UI and UX. Every interaction is an opportunity to learn about decentralized data, transparency, and verifiability.

## Teaching Through Tooltips

Dashboard statistics cards reveal the underlying Arkiv queries on hover, teaching users how data is queried from the blockchain:

**Example: Sessions Completed**
```
Arkiv query: type='session',
(mentorWallet='0x4b6D14...' OR learnerWallet='0x4b6D14...'),
status='completed' OR (status='scheduled' AND sessionDate < now)
```

**Example: Average Rating**
```
Arkiv query: type='session_feedback',
feedbackTo='0x4b6D14...'
```

**Example: Skills Learning**
```
Arkiv query: type='learning_follow',
profile_wallet='0x4b6D14...',
active=true
```

These tooltips show users that every statistic is verifiable on-chain, not computed from a centralized database. Users learn that data comes from querying blockchain entities, not from hidden servers.

## Visualizing Public Blockchain

Every user-generated entity includes a "View on Arkiv" link that opens the Mendoza testnet explorer. This teaches users that:

1. **Data is public**: All entities are viewable on the public blockchain explorer
2. **Data is permanent**: Transaction hashes provide cryptographic proof of existence
3. **Data is verifiable**: Anyone can inspect the raw entity data on-chain

**Examples throughout the UI:**
- Profile entities: "View on Arkiv" links show the raw entity data
- Garden notes: "Public Arkiv entry" links with transaction hash
- Sessions: Links to session entities and payment transactions
- Skills: Links to skill entity creation transactions
- Availability blocks: Links to availability entity transactions

## Educational Moments

**"What is Arkiv?" Button**
When composing garden notes, users can click "What is Arkiv?" to learn:
> "Arkiv is the trustless data layer your notes live on. Everything here is public and permanent."

This teaches the core blockchain philosophy: trustless infrastructure where data ownership is decentralized.

**Transparency Warnings**
On profile creation and data input forms, users see:
> "Blockchain data is immutable. All data inputted is viewable forever on the Arkiv explorer."

This teaches users about blockchain immutability and transparency before they commit data.

**Auth Page Education**
The authentication page explains:
> "Blockchain data is immutable and transparent by design. All data inputted on this beta is viewable on the Arkiv explorer."

Users learn that blockchain transparency is a feature, not a bug.

## Teaching Blockchain Philosophy

**Data Sovereignty**
By showing "View on Arkiv" links on every entity, users learn that:
- They own their data (it's on the blockchain, not in our database)
- They can verify their data exists independently of the application
- The application is a client of a shared data layer, not the owner

**Trustlessness**
By revealing Arkiv queries in tooltips, users learn that:
- Statistics are computed from verifiable on-chain data
- No hidden algorithms or opaque calculations
- Everything can be verified independently

**Transparency**
By linking to the public explorer, users learn that:
- Blockchain data is public by design
- Anyone can inspect the data
- Cryptographic proofs ensure data integrity

## Examples in Practice

**Garden Notes**
Each garden note displays "Public Arkiv entry" with a link to the transaction hash. Users see that their messages are stored as permanent blockchain entities, not ephemeral database records.

**Dashboard Statistics**
Hovering over stat cards reveals the exact Arkiv queries used. Users learn that "Sessions Completed" isn't a number pulled from a database, but a query result from the blockchain.

**Profile Management**
Every profile update shows a "View on Arkiv" link. Users learn that profile changes create new blockchain entities, demonstrating immutability and versioning.

**Network Graph**
The network visualization shows asks, offers, and matches, all with "View on Arkiv" links. Users learn that the entire network graph is built from queryable blockchain entities.

## Design Philosophy

We don't hide the blockchain. We celebrate it. Every UI element that could show blockchain data does so. Every statistic that could reveal its query does so. Every entity that could link to the explorer does so.

This approach teaches users that blockchain isn't just a backend technology. It's a fundamental shift in how data ownership, transparency, and verifiability work. By making the blockchain visible and accessible, we help users understand both the technology and the philosophy behind decentralized systems.


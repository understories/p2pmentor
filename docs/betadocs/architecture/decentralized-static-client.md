# Decentralized Static Client

## Overview

The static client is a **read-only, no-JavaScript snapshot viewer** for p2pmentor data. It renders **public data pulled from Arkiv at build time** and is **content-addressed on IPFS** with optional **ENS naming**. 

Every build includes a **snapshot manifest** that documents exactly what Arkiv data was used, enabling verification that the rendered content matches the on-chain source.

**Note:** The static client requires build infrastructure to generate snapshots. During beta, builds run on our infrastructure; output remains FLOSS and content-addressed.

This mode is intended for users who value inspectability, archival access, censorship resistance, and verifiability over interactivity.

## Goals

### Beta Goals (Current)

1. **No JavaScript**: Application functions entirely with HTML and CSS only
2. **FLOSS Compliance**: All components, tools, and dependencies are Free/Libre and Open Source Software
3. **Read-Only Viewer**: Browse public profiles, asks, offers, and skills
4. **Verifiable Snapshots**: Every build includes provenance manifest for verification
5. **IPFS Compatibility**: Deployable on IPFS with content-addressed storage
6. **Deterministic Builds**: Reproducible outputs for verification

### Future Goals

- **Complete Data Coverage**: Display all Arkiv entity types (currently MVP covers core entities)
- **Automated Publishing**: Automated builds and IPFS+ENS updates
- **ENS Integration**: Human-readable domain access via Ethereum Name Service

**Note:** During beta, builds run on our infrastructure; output remains FLOSS and content-addressed.

## Capabilities and Limitations

### What the No-JS Client Can Do

- **Browse public data**: View profiles, asks, offers, and skills
- **View snapshot manifest**: Access provenance documentation showing exactly what Arkiv data was used
- **Verify data correctness**: Compare snapshot digests against independent Arkiv queries
- **Access without JavaScript**: Works in locked-down browsers, archival crawlers, and old devices
- **Inspect as plain text**: All content is readable HTML/CSS

### What the No-JS Client Cannot Do

- **Connect wallet**: No authentication or wallet connection
- **Create or edit entities**: Read-only viewer, no write operations
- **Show real-time updates**: Data only updates when the site is rebuilt
- **Guarantee correctness without verification**: Users must verify snapshot manifest against Arkiv to confirm data accuracy

**Important:** The static client is a **snapshot viewer**, not a live application. It shows data as it existed at build time, not current state.

## Architecture

### Build-Time Data Fetching

Instead of querying Arkiv at runtime, the static client:

1. **Build Script**: Node.js/TypeScript script queries Arkiv network during build
2. **Data Processing**: Processes and normalizes all entity data
3. **Static Generation**: Custom TypeScript renderer generates HTML pages (beta)
4. **IPFS Deployment**: Static HTML files deployed to IPFS
5. **ENS Linking**: ENS domain points to IPFS content hash

### Technology Stack

- **Static Renderer**: Custom TypeScript generator (beta); may migrate to Hugo/11ty later
- **Build Script**: Node.js/TypeScript using existing Arkiv SDK
- **Deployment**: IPFS via ipfs-deploy or IPFS CLI
- **Naming**: ENS for human-readable domains (future)

### Data Coverage

**Beta (Current):**
- User profiles
- Skills
- Asks
- Offers

**Future:**
- Sessions
- Availability
- Session feedback
- Virtual gatherings
- App feedback
- Garden notes
- Notifications
- Learning follows
- Transaction hash tracking

## Access Methods

### From Main Site

1. **Prominent Button**: "Load Without JavaScript" button on landing page
2. **Automatic Redirect**: Users with JavaScript disabled are automatically redirected
3. **Direct Path**: The no-JS site is also reachable directly at `/static/` (or configured path)

### Direct Access

1. **IPFS**: `ipfs://<CID>` or via IPFS gateways (e.g., `https://ipfs.io/ipfs/<CID>`)
2. **ENS**: `p2pmentor.eth` (when configured) or via ENS gateways

**Note:** The entrypoint is explicit and stable. Once published, the IPFS CID provides a permanent, content-addressed URL.

## Verifiability and Provenance

**Important distinction:** IPFS guarantees content integrity (the bytes you fetched are exactly what was published). The snapshot manifest enables *data correctness verification* by allowing independent recomputation from Arkiv.

Every static build includes a **snapshot manifest** (`/snapshot/index.html` and `snapshot.json`) that documents:

- **Snapshot ID**: Unique identifier for this build
- **Snapshot Time**: Data cutoff timestamp (when Arkiv data was queried)
- **Space ID**: Arkiv space identifier used
- **Query Parameters**: Exact queries used to fetch data
- **Entity Counts**: Number of entities per type
- **Entity Key Digests**: SHA256 hashes of sorted entity keys (for verification)
- **Entity Keys**: Full key lists for small datasets (< 1000 entities)
- **Renderer Version**: Version of the static renderer used
- **Build Git SHA**: Git commit of renderer code (for reproducibility)
- **Arkiv Source**: Exact RPC/GraphQL endpoints used

Every page includes the snapshot ID in the footer and links to `/snapshot/` for full provenance details.

### How to Verify

1. **Confirm source**: Verify you loaded the site from the expected IPFS CID or ENS name
2. **Check snapshot**: Open `/snapshot/` and record the snapshot ID and entity key digests
3. **Re-run queries**: Execute the same Arkiv queries (or use an independent indexer) using the snapshot manifest parameters
4. **Compare digests**: Confirm the entity key digest matches your independent query results

This enables verification that the rendered content matches the on-chain source without requiring trust in the build infrastructure.

**Threat model:** This design assumes a potentially untrusted build operator, but a verifiable data source (Arkiv), and allows any third party to independently audit the published snapshot.

## Publishing and Availability

### IPFS Hosting

IPFS content requires **pinning** for availability. Content will vanish from the network unless actively pinned.

**During Beta:**
- We pin via our infrastructure
- Optionally pinned via a pinning service (Pinata, Web3.Storage, etc.) for redundancy
- Users can also pin the CID on their own IPFS nodes

**Pinning Strategy:**
- Local IPFS node (required)
- At least one pinning service (for redundancy)
- Users encouraged to pin if they want to ensure long-term availability

### ENS Integration

ENS domains point to IPFS content via the `contenthash` field (ENSIP-7). Each successful publish:

- Returns a content CID
- Can optionally update ENS `contenthash` record
- Provides human-readable domain access (e.g., `p2pmentor.eth`)

**Note:** ENS updates require transaction signing. For production, use a separate signer (hardware wallet/multisig) for security.

## Implementation Status

### MVP (Beta Launch Companion)

**Phase 1**: Landing page integration (no-JS button and redirect)  
**Phase 2**: Build script for core entities (profiles, skills, asks, offers)  
**Phase 3**: Static site setup with basic templates  
**Phase 4**: Core entity display with basic styling  
**Phase 5**: Snapshot manifest generation (verification-critical)  
**Phase 6**: Deterministic builds (fixed cutoff time, stable sorting)  
**Phase 7**: No-JS guardrail checks in CI  
**Phase 8**: Snapshot page and per-page provenance footer  
**Phase 9**: IPFS deployment  
**Phase 10**: Testing and polish

### Trust Requirements (In Progress)

- [x] Snapshot manifest generation
- [x] Deterministic build process (fixed `snapshotTime`, stable sorting)
- [x] Entity key digest computation (SHA256 of sorted keys)
- [x] No-JS guardrail verification
- [ ] Snapshot page generation (`/snapshot/index.html`)
- [ ] Per-page provenance footer
- [ ] Inputs metadata (`inputs.json`)

### Full Implementation

Complete implementation includes all entity types, advanced features, automated builds, and ENS integration. See full implementation plan in `refs/static-build-experiment-implementation-plan.md` (internal).

## Benefits

1. **Content-Addressed Storage**: IPFS provides immutable, verifiable content
2. **Censorship Resistance**: Content-addressed storage on IPFS
3. **Accessibility**: Works without JavaScript, accessible to all users and archival systems
4. **Verifiability**: Snapshot manifest enables independent verification of data accuracy
5. **FLOSS Compliance**: Fully open source, no proprietary dependencies
6. **Future-Proof**: Plain HTML/CSS renders in any environment, including locked-down browsers and archival crawlers

## Related Documentation

- **Implementation Plan**: `refs/static-build-experiment-implementation-plan.md` (internal)
- **Arkiv Data Model**: [Arkiv Data Model](/docs/arkiv/data-model)
- **Serverless Architecture**: [Serverless & Trustless](/docs/philosophy/serverless-and-trustless)


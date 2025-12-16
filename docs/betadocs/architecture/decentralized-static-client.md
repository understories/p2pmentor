# Decentralized Static Client

## Overview

p2pmentor is committed to building a fully decentralized, no-JavaScript version of the application that works entirely without centralized servers. This static client will be deployable on IPFS and accessible via ENS, providing true decentralization and censorship resistance.

## Goals

1. **No JavaScript**: Application functions entirely with HTML and CSS only
2. **FLOSS Compliance**: All components, tools, and dependencies are Free/Libre and Open Source Software
3. **Server Independence**: No reliance on Vercel, API routes, or any centralized server
4. **IPFS Compatibility**: Fully deployable on IPFS with content-addressed storage
5. **ENS Integration**: Accessible via Ethereum Name Service domains
6. **Complete Data Display**: Show all data from Arkiv (all entity types)

## Architecture

### Build-Time Data Fetching

Instead of querying Arkiv at runtime, the static client:

1. **Build Script**: Node.js/TypeScript script queries Arkiv network during build
2. **Data Processing**: Processes and normalizes all entity data
3. **Static Generation**: Static site generator (Hugo/11ty) generates HTML pages
4. **IPFS Deployment**: Static HTML files deployed to IPFS
5. **ENS Linking**: ENS domain points to IPFS content hash

### Technology Stack

- **Static Site Generator**: Hugo (recommended) or 11ty
- **Build Script**: Node.js/TypeScript using existing Arkiv SDK
- **Deployment**: IPFS via ipfs-deploy
- **Naming**: ENS for human-readable domains

### Data Coverage

The static client displays all Arkiv entity types:

**Core Entities:**
- User profiles
- Skills
- Asks
- Offers
- Sessions
- Availability
- Session feedback
- Virtual gatherings

**Supporting Entities:**
- App feedback
- Garden notes
- Notifications
- Learning follows
- Transaction hash tracking

## Access Methods

### From Main Site

1. **Prominent Button**: "Load Without JavaScript" button on landing page
2. **Automatic Redirect**: Users with JavaScript disabled are automatically redirected

### Direct Access

1. **IPFS**: `ipfs://<CID>` or via IPFS gateways
2. **ENS**: `p2pmentor.eth` (when configured) or via ENS gateways

## Implementation Status

### MVP (Beta Launch Companion)

**Phase 1**: Landing page integration (no-JS button and redirect)  
**Phase 2**: Build script for core entities (profiles, skills, asks, offers)  
**Phase 3**: Static site setup with basic templates  
**Phase 4**: Core entity display with basic styling  
**Phase 5**: IPFS deployment  
**Phase 6**: Testing and polish

### Full Implementation

Complete implementation includes all entity types, advanced features, automated builds, and ENS integration. See full implementation plan in `refs/docs/DECENTRALIZED_STATIC_APP_IMPLEMENTATION_PLAN.md`.

## Benefits

1. **True Decentralization**: No reliance on centralized servers
2. **Censorship Resistance**: Content-addressed storage on IPFS
3. **Accessibility**: Works without JavaScript, accessible to all users
4. **Data Ownership**: Users can verify all data on-chain
5. **FLOSS Compliance**: Fully open source, no proprietary dependencies

## Related Documentation

- **Full Implementation Plan**: `refs/docs/DECENTRALIZED_STATIC_APP_IMPLEMENTATION_PLAN.md` (internal)
- **Arkiv Data Model**: [Arkiv Data Model](../arkiv/data-model.md)
- **Serverless Architecture**: [Serverless & Trustless](../philosophy/serverless-and-trustless.md)


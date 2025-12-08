# Arkiv GraphQL Demo - Standalone Package Plan

**Target**: `understories/arkiv-graphql-demo`  
**Purpose**: Standalone demo/package for people building on Arkiv  
**Status**: Planning

---

## Package Structure

```
arkiv-graphql-demo/
├── README.md                    # Main documentation
├── package.json                 # Package manifest
├── .env.example                 # Environment variables
├── tsconfig.json                # TypeScript config
├── 
├── src/                         # Core implementation
│   ├── graphql/
│   │   ├── schema.ts           # GraphQL schema
│   │   ├── resolvers.ts        # Query resolvers
│   │   ├── transformers.ts     # Entity transformers
│   │   └── server.ts            # GraphQL server setup
│   ├── client/
│   │   ├── graphql-client.ts   # GraphQL client
│   │   └── queries.ts           # Query helpers
│   └── arkiv/
│       └── index.ts             # Arkiv SDK wrapper (minimal)
│
├── app/                         # Next.js demo app
│   ├── api/
│   │   └── graphql/
│   │       └── route.ts         # GraphQL endpoint
│   ├── demo/
│   │   └── page.tsx             # Demo comparison page
│   └── layout.tsx
│
├── components/                   # Demo components
│   ├── GraphQLDemo.tsx          # Performance demo
│   ├── UXVision.tsx             # UX possibilities
│   ├── UXVisualizations.tsx     # Visual mockups
│   ├── CodeComparison.tsx       # Code comparison
│   └── IntegrationGuide.tsx     # Integration guide
│
├── scripts/                      # Utility scripts
│   ├── seed-demo-data.ts        # Seed demo data
│   └── test-graphql.ts          # Test script
│
├── docs/                         # Documentation
│   ├── GETTING_STARTED.md       # Quick start guide
│   ├── API_REFERENCE.md         # API documentation
│   ├── ARCHITECTURE.md          # Architecture overview
│   └── EXAMPLES.md              # Usage examples
│
└── public/                       # Static assets
    └── demo-data.json           # Sample data for demo
```

---

## Core Files to Extract

### 1. GraphQL Implementation
- `app/api/graphql/route.ts` → `app/api/graphql/route.ts`
- `lib/graphql/schema.ts` → `src/graphql/schema.ts`
- `lib/graphql/resolvers.ts` → `src/graphql/resolvers.ts`
- `lib/graphql/transformers.ts` → `src/graphql/transformers.ts`

### 2. Client & Queries
- `lib/graph/client.ts` → `src/client/graphql-client.ts`
- `lib/graph/networkQueries.ts` → `src/client/queries.ts`
- `lib/graph/networkAdapter.ts` → `src/client/adapter.ts`

### 3. Demo Components
- `app/network/compare/page.tsx` → `app/demo/page.tsx`
- `components/network/GraphQLDemo.tsx` → `components/GraphQLDemo.tsx`
- `components/network/UXVision.tsx` → `components/UXVision.tsx`
- `components/network/UXVisualizations.tsx` → `components/UXVisualizations.tsx`
- `components/network/CodeComparison.tsx` → `components/CodeComparison.tsx`
- `components/network/IntegrationGuide.tsx` → `components/IntegrationGuide.tsx`

### 4. Documentation
- `docs/ARKIV_GRAPHQL_TOOL.md` → `README.md` (main)
- `docs/arkiv_graphql_wrapper_approach.md` → `docs/ARCHITECTURE.md`
- `lib/graphql/README.md` → `docs/API_REFERENCE.md`

### 5. Scripts
- `scripts/seed-network-test.ts` → `scripts/seed-demo-data.ts`
- `scripts/test-graphql-standalone.ts` → `scripts/test-graphql.ts`

---

## Dependencies

### Core Dependencies
```json
{
  "dependencies": {
    "@arkiv-network/sdk": "^0.4.4",
    "graphql": "^16.12.0",
    "graphql-http": "^1.22.4"
  },
  "devDependencies": {
    "@types/node": "^22.15.29",
    "typescript": "^5.7.2",
    "dotenv": "^17.2.3"
  }
}
```

### Demo App Dependencies (if including Next.js demo)
```json
{
  "dependencies": {
    "next": "^15.5.7",
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  }
}
```

---

## Package.json Structure

```json
{
  "name": "@understories/arkiv-graphql-demo",
  "version": "1.0.0",
  "description": "GraphQL API wrapper for Arkiv - Demo and reference implementation",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "seed": "tsx scripts/seed-demo-data.ts",
    "test": "tsx scripts/test-graphql.ts"
  },
  "keywords": [
    "arkiv",
    "graphql",
    "blockchain",
    "decentralized",
    "demo"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/understories/arkiv-graphql-demo"
  },
  "license": "MIT"
}
```

---

## README Structure

1. **Overview** - What this is
2. **Quick Start** - Get running in 5 minutes
3. **Demo** - Live demo link
4. **Architecture** - How it works
5. **API Reference** - GraphQL schema
6. **Integration Guide** - How to use in your app
7. **Examples** - Code examples
8. **Contributing** - How to contribute

---

## Key Features to Highlight

1. **GraphQL Interface** - Clean API over Arkiv JSON-RPC
2. **Live Demo** - Interactive comparison page
3. **Visual Mockups** - UX possibilities
4. **Performance Metrics** - Real comparisons
5. **Integration Guide** - Step-by-step setup
6. **Reference Implementation** - Production-ready code

---

## Next Steps

1. ✅ Create package structure plan
2. ⏸️ Extract core files
3. ⏸️ Create standalone README
4. ⏸️ Set up demo data seeding
5. ⏸️ Test standalone package
6. ⏸️ Create GitHub repo
7. ⏸️ Deploy demo (Vercel/Netlify)

---

## Commit Strategy

### Commit 1: Core GraphQL Implementation
- GraphQL schema, resolvers, transformers
- GraphQL endpoint
- Basic client

### Commit 2: Demo Application
- Comparison page
- Demo components
- Visual mockups

### Commit 3: Documentation
- README
- API reference
- Integration guide
- Examples

### Commit 4: Standalone Package Setup
- Package.json
- Environment setup
- Seed scripts
- Test scripts


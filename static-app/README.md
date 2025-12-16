# Static Client for p2pmentor

No-JavaScript, fully decentralized version of p2pmentor that works entirely without centralized servers.

## Build

```bash
# Generate static data from Arkiv and create HTML pages
npm run build:static
```

This will:
1. Fetch all core entities from Arkiv
2. Process and index the data
3. Generate static HTML pages

Output is in `static-app/public/`

## Deploy to IPFS

### Option 1: Using ipfs-deploy (Recommended)

```bash
npm install -g ipfs-deploy
./scripts/deploy-ipfs.sh
```

### Option 2: Using IPFS CLI

```bash
# Install IPFS: https://docs.ipfs.io/install/
ipfs add -r static-app/public/
# Pin the CID to prevent garbage collection
ipfs pin add <CID>
```

### Option 3: Manual Upload

1. Upload `static-app/public/` to IPFS pinning service (Pinata, Web3.Storage, etc.)
2. Get the CID
3. Access via IPFS gateways: `https://ipfs.io/ipfs/<CID>`

## Access

Once deployed, update the landing page button (`app/page.tsx`) to point to the IPFS URL:

```tsx
<a href="https://ipfs.io/ipfs/<CID>">Load Without JavaScript</a>
```

Or use an ENS domain that points to the IPFS CID.

## Structure

- `static-app/public/` - Generated HTML pages (gitignored)
- `static-app/static/css/` - CSS files
- `scripts/build-static-data.ts` - Fetches data from Arkiv
- `scripts/generate-static-html.ts` - Generates HTML pages

## Notes

- All data is fetched at build time from Arkiv
- No JavaScript required - pure HTML/CSS
- Works on IPFS and ENS
- Data is not committed to repo (generated at build time)


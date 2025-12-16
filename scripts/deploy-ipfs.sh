#!/bin/bash
# Deploy static client to IPFS
# 
# This script deploys the generated static HTML to IPFS.
# Requires: ipfs-deploy (npm install -g ipfs-deploy) or ipfs CLI

set -e

STATIC_DIR="static-app/public"

if [ ! -d "$STATIC_DIR" ]; then
  echo "❌ Error: $STATIC_DIR not found. Run 'npm run build:static' first."
  exit 1
fi

echo "🚀 Deploying to IPFS..."

# Check for ipfs-deploy
if command -v ipfs-deploy &> /dev/null; then
  echo "Using ipfs-deploy..."
  ipfs-deploy "$STATIC_DIR" -p pinata -d cloudflare
elif command -v ipfs &> /dev/null; then
  echo "Using ipfs CLI..."
  CID=$(ipfs add -r -Q "$STATIC_DIR")
  echo "✅ Content added to IPFS with CID: $CID"
  echo "📌 Remember to pin this CID to prevent garbage collection:"
  echo "   ipfs pin add $CID"
  echo ""
  echo "🌐 Access via:"
  echo "   https://ipfs.io/ipfs/$CID"
  echo "   https://cloudflare-ipfs.com/ipfs/$CID"
else
  echo "❌ Error: Neither ipfs-deploy nor ipfs CLI found."
  echo ""
  echo "Install one of:"
  echo "  npm install -g ipfs-deploy"
  echo "  or install IPFS: https://docs.ipfs.io/install/"
  exit 1
fi

echo ""
echo "✅ Deployment complete!"
echo "📝 Update landing page button to point to IPFS URL"


#!/bin/bash
# Build script for static client
# 1. Generate static data from Arkiv
# 2. Copy data to Hugo data directory
# 3. Build Hugo site

set -e

echo "🔍 Step 1: Generating static data from Arkiv..."
npm run build:static-data

echo "📁 Step 2: Copying data to Hugo data directory..."
cp -r static-data/entities/*.json data/
cp -r static-data/indexes/*.json data/
cp static-data/metadata/build-timestamp.json data/

echo "🏗️  Step 3: Building Hugo site..."
hugo --minify

echo "✅ Build complete! Output in public/"


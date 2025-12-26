#!/bin/bash
# Test static client locally
# Serves the static HTML files on localhost:8080

set -e

STATIC_DIR="static-app/public"

if [ ! -d "$STATIC_DIR" ]; then
  echo "❌ Error: $STATIC_DIR not found. Run 'npm run build:static' first."
  exit 1
fi

echo "🌐 Starting local server for static client..."
echo "📁 Serving: $STATIC_DIR"
echo "🔗 Open in browser: http://localhost:8080"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

cd "$STATIC_DIR"
python3 -m http.server 8080





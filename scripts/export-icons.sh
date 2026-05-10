#!/bin/bash
# SVG → PNG icon export script
# Primary: uses @resvg/resvg-js (Node.js) — no external CLI needed
# Fallback: requires svgexport npm package (npm install -g svgexport)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."

if node "$SCRIPT_DIR/export-icons.mjs" 2>/dev/null; then
  echo "Icons generated via @resvg/resvg-js"
  exit 0
fi

# Fallback: svgexport CLI
SVG="$ROOT/public/icons/icon.svg"
OUT="$ROOT/public/icons"
for size in 16 32 48 128 256; do
  svgexport "$SVG" "$OUT/icon${size}.png" "${size}:${size}"
  echo "Generated icon${size}.png"
done
echo "All icons exported via svgexport."

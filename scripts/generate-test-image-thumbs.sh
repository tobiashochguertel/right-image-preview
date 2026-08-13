#!/usr/bin/env bash
# Generate / refresh Demo 6 minimap thumbs under ./test-images/thumbs/
# Matching filenames required by vite.config.ts manifest. Max edge 320px (same as existing set).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/test-images"
THUMBS="$DIR/thumbs"
mkdir -p "$THUMBS"

shopt -s nullglob
count=0
for src in "$DIR"/*.{JPG,jpg,JPEG,jpeg,PNG,png,WEBP,webp}; do
  base="$(basename "$src")"
  out="$THUMBS/$base"
  if [[ -f "$out" ]]; then
    continue
  fi
  echo "thumb ← $base"
  sips -Z 320 "$src" --out "$out" >/dev/null
  count=$((count + 1))
done

echo "Generated $count new thumb(s). Total thumbs: $(ls -1 "$THUMBS" | wc -l | tr -d ' ')"

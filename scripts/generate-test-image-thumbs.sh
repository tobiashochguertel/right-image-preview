#!/usr/bin/env bash
# Optional: generate Demo 6 minimap thumbs under ./test-images/thumbs/
# mirroring the original relative path. Demo 6 does not require thumbs —
# originals in any subfolder already appear in the gallery.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/test-images"
THUMBS="$DIR/thumbs"
mkdir -p "$THUMBS"

if [[ ! -d "$DIR" ]]; then
  echo "No $DIR — nothing to do."
  exit 0
fi

count=0
while IFS= read -r -d '' src; do
  rel="${src#"$DIR"/}"
  out="$THUMBS/$rel"
  if [[ -f "$out" ]]; then
    continue
  fi
  mkdir -p "$(dirname "$out")"
  echo "thumb ← $rel"
  if sips -Z 320 "$src" --out "$out" >/dev/null; then
    count=$((count + 1))
  else
    echo "skip (sips failed): $rel" >&2
  fi
done < <(find "$DIR" \( -path "$THUMBS" -o -path "$THUMBS/*" \) -prune -o -type f \( \
  -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' \
\) -print0)

echo "Generated $count new thumb(s)."

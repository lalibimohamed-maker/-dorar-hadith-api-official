#!/usr/bin/env bash
set -euo pipefail

: "${DINULLAH_STUDIO_RELEASE:=dinullah-media-studio-v2026.09.29}"
: "${DINULLAH_STUDIO_DIR:=runtime-data/studio-tools}"
: "${GITHUB_REPOSITORY:=lalibimohamed-maker/-dorar-hadith-api-official}"

require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "Missing command: $1" >&2; exit 1; }; }
require_cmd curl
require_cmd sha256sum
require_cmd tar

mkdir -p "$DINULLAH_STUDIO_DIR"
base="https://github.com/$GITHUB_REPOSITORY/releases/download/$DINULLAH_STUDIO_RELEASE"

echo "[STUDIO RELEASE] $DINULLAH_STUDIO_RELEASE"

curl --fail --location --retry 3 --proto '=https' --tlsv1.2 -o "$DINULLAH_STUDIO_DIR/media-studio-sha256.txt" "$base/media-studio-sha256.txt"

# Release cache is the only runtime source. No upstream fallback is permitted.
while IFS= read -r sum file; do
  [[ -n "$sum" && -n "$file" ]] || continue
  name="$(basename "$file")"
  curl --fail --location --retry 3 --proto '=https' --tlsv1.2 -o "$DINULLAH_STUDIO_DIR/$name" "$base/$name"
  echo "$sum  $DINULLAH_STUDIO_DIR/$name" | sha256sum -c -
  echo "[STUDIO VERIFIED] $name"
done < <(grep -E '^[0-9a-f]{64}[[:space:]]+release-assets/' "$DINULLAH_STUDIO_DIR/media-studio-sha256.txt" | sed 's#release-assets/##')

echo "[STUDIO READY] $DINULLAH_STUDIO_DIR"

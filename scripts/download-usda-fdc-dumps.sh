#!/usr/bin/env bash
# Scarica ed estrae Foundation + SR Legacy (JSON) da USDA FDC.
# Richiede: curl, unzip
#
# Uso (root monorepo):
#   bash scripts/download-usda-fdc-dumps.sh
#   USDA_FDC_FOUNDATION_RELEASE=2025-04-24 bash scripts/download-usda-fdc-dumps.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="${USDA_FDC_OUT_DIR:-$ROOT/data/usda-fdc}"
FOUNDATION_RELEASE="${USDA_FDC_FOUNDATION_RELEASE:-2025-12-18}"
SR_LEGACY_RELEASE="${USDA_FDC_SR_LEGACY_RELEASE:-2018-04}"
mkdir -p "$OUT_DIR"

download_one() {
  local url="$1"
  local dest_name="$2"
  local tmp zip extract json_src dest
  tmp="$(mktemp -d)"
  zip="$tmp/archive.zip"
  extract="$tmp/extract"
  mkdir -p "$extract"
  echo ">> Download $url"
  curl -fsSL "$url" -o "$zip"
  unzip -q "$zip" -d "$extract"
  json_src="$(find "$extract" -name '*.json' | head -n 1)"
  if [[ -z "$json_src" ]]; then
    echo "Nessun .json nello zip: $url" >&2
    exit 1
  fi
  dest="$OUT_DIR/$dest_name"
  cp "$json_src" "$dest"
  echo "   OK $dest (da $(basename "$json_src"))"
  rm -rf "$tmp"
}

FOUNDATION_URL="https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_json_${FOUNDATION_RELEASE}.zip"
SR_URL="https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_${SR_LEGACY_RELEASE}.zip"

echo "USDA FDC dump -> $OUT_DIR"
download_one "$FOUNDATION_URL" "FoundationFoods.json"
download_one "$SR_URL" "SRLegacyFoods.json"
echo ""
echo "Fatto. Prossimo passo:"
echo "  npx tsx apps/web/scripts/import-usda-fdc-dump.ts --dry-run"
echo "  npx tsx apps/web/scripts/import-usda-fdc-dump.ts"

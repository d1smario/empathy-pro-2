# Scarica ed estrae Foundation + SR Legacy (JSON) da USDA FDC.
# Output: data/usda-fdc/FoundationFoods.json e SRLegacyFoods.json (gitignored)
#
# Uso (dalla root del monorepo):
#   .\scripts\download-usda-fdc-dumps.ps1
#   .\scripts\download-usda-fdc-dumps.ps1 -FoundationRelease 2025-04-24
#
# Poi import Supabase:
#   npx tsx apps/web/scripts/import-usda-fdc-dump.ts --dry-run
#   npx tsx apps/web/scripts/import-usda-fdc-dump.ts

param(
  [string]$FoundationRelease = $(if ($env:USDA_FDC_FOUNDATION_RELEASE) { $env:USDA_FDC_FOUNDATION_RELEASE } else { "2025-12-18" }),
  [string]$SrLegacyRelease = $(if ($env:USDA_FDC_SR_LEGACY_RELEASE) { $env:USDA_FDC_SR_LEGACY_RELEASE } else { "2018-04" }),
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
if (-not $OutDir) { $OutDir = Join-Path $Root "data\usda-fdc" }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$FoundationUrl = "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_json_$FoundationRelease.zip"
$SrUrl = "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_$SrLegacyRelease.zip"

function Save-ZipJsonAs {
  param(
    [string]$Url,
    [string]$DestFileName
  )
  $zip = Join-Path $env:TEMP ("fdc-dl-" + [guid]::NewGuid().ToString("n") + ".zip")
  $extractDir = Join-Path $env:TEMP ("fdc-extract-" + [guid]::NewGuid().ToString("n"))
  try {
    Write-Host ">> Download $Url"
    Invoke-WebRequest -Uri $Url -OutFile $zip -UseBasicParsing
    Expand-Archive -Path $zip -DestinationPath $extractDir -Force
    $json = Get-ChildItem -Path $extractDir -Filter "*.json" -Recurse | Select-Object -First 1
    if (-not $json) { throw "Nessun .json nello zip: $Url" }
    $dest = Join-Path $OutDir $DestFileName
    Copy-Item -Path $json.FullName -Destination $dest -Force
    $mb = [math]::Round((Get-Item $dest).Length / 1MB, 1)
    Write-Host "   OK $dest ($mb MB, da $($json.Name))"
  }
  finally {
    if (Test-Path $zip) { Remove-Item $zip -Force -ErrorAction SilentlyContinue }
    if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue }
  }
}

Write-Host "USDA FDC dump -> $OutDir"
Save-ZipJsonAs -Url $FoundationUrl -DestFileName "FoundationFoods.json"
Save-ZipJsonAs -Url $SrUrl -DestFileName "SRLegacyFoods.json"
Write-Host ""
Write-Host "Fatto. Prossimo passo:"
Write-Host "  npx tsx --tsconfig apps/web/tsconfig.json apps/web/scripts/import-usda-fdc-dump.ts --dry-run"
Write-Host "  npx tsx --tsconfig apps/web/tsconfig.json apps/web/scripts/import-usda-fdc-dump.ts"

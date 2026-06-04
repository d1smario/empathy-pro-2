# Nutrizione — cache locale USDA FDC (`nutrition_fdc_foods`)

## Scopo

Un solo contenitore USDA in Supabase: **`nutrition_fdc_foods`**. Il meal plan, il diario e il food lookup leggono da lì; le chiamate live a `api.nal.usda.gov` sono opzionali finché la cache non è popolata, poi disattivabili in produzione.

## Sorgenti dati (non confondere)

| Sorgente | Ruolo |
|--------|--------|
| `nutrition_fdc_foods` | USDA FDC (macro + micro + indici metabolici stimati) |
| `nutrition_product_catalog` | Integratori / brand-site (dichiarazioni fornitore) |
| `CANONICAL_FOOD_TABLE` (TS) | Vocabolario `canonicalKey` + fallback RAM se FDC assente |
| `canonical-food-fdc-aliases.ts` | Mappa `canonicalKey` → `fdc_id` per il solver |

## Fase dati (Foundation + SR Legacy)

### Download da terminale (consigliato)

Dalla **root del monorepo** (Windows PowerShell):

```powershell
.\scripts\download-usda-fdc-dumps.ps1
```

macOS/Linux (serve `curl` + `unzip`):

```bash
bash scripts/download-usda-fdc-dumps.sh
```

Default: Foundation `2025-12-18`, SR Legacy `2018-04` (URL diretti `fdc.nal.usda.gov/fdc-datasets/…`).  
Override release Foundation: `$env:USDA_FDC_FOUNDATION_RELEASE='2025-04-24'` (PowerShell) o `USDA_FDC_FOUNDATION_RELEASE=2025-04-24` (bash).

Output in `data/usda-fdc/` (gitignored):

- `FoundationFoods.json`
- `SRLegacyFoods.json`

Elenco release: [FoodData Central — Download](https://fdc.nal.usda.gov/download-datasets.html).

### Import Supabase

Da root monorepo, con `SUPABASE_SERVICE_ROLE_KEY` in `apps/web/.env.local`:

```bash
npx tsx --tsconfig apps/web/tsconfig.json apps/web/scripts/import-usda-fdc-dump.ts --dry-run
npx tsx --tsconfig apps/web/tsconfig.json apps/web/scripts/import-usda-fdc-dump.ts
```

Opzioni: `--limit=N`, `--dry-run`.

Warm incrementale (query italiane comuni): `npx tsx apps/web/scripts/warm-usda-bulk.ts`.

## Runtime Pro 2

- **Meal plan:** `buildFdcCanonicalSnapshot` → `loadFdcFoodsByIds` (batch `fdc_id IN (...)`), nessun `Promise.all` di import USDA per chiave.
- **Diario / dettaglio FDC:** `getOrImportFdcFood` (cache miss → import API se consentito).
- **Lookup testuale:** catalogo → cache ILIKE → discovery USDA (solo se `USDA_API_KEY` e **non** `FDC_CACHE_ONLY`).

### Variabili (`apps/web/.env.local` / Vercel)

```env
USDA_API_KEY=…
# Dopo import bulk + smoke test su produzione:
FDC_CACHE_ONLY=1
```

Con `FDC_CACHE_ONLY=1`:

- `getOrImportFdcFood` non chiama USDA su miss (`fdc_not_in_local_cache`).
- `runCanonicalNutritionLookup` non usa `searchUsdaFdcDiscovery`.

Abilitare su Vercel **solo** dopo smoke: meal plan, `/api/nutrition/food-lookup`, diario con `fdc_id` noti.

## Estensione alias

Aggiorna `apps/web/lib/nutrition/canonical-food-fdc-aliases.ts` quando un alimento del solver ha un `fdc_id` verificato in cache. Report da bulk warmer: `apps/web/scripts/usda-bulk-aliases.json`.

## Migration

Schema base: `supabase/migrations/025_nutrition_fdc_food_cache.sql`  
Indici metabolici: `036` / `038`.

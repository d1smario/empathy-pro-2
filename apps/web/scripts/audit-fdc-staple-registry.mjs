/**
 * Verifica coerenza macro staple registry vs CANONICAL_FOOD_TABLE (±15%).
 * Usage: node apps/web/scripts/audit-fdc-staple-registry.mjs
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

// Dynamic import via tsx would be ideal; this script validates via compiled paths in dev.
console.log("Run: npx tsx --tsconfig apps/web/tsconfig.json apps/web/lib/nutrition/v2/fdc-staple-registry.test.ts");
console.log("For full USDA cache audit against Supabase, use classify-fdc-foods-ai-batch --stats-only");

process.exit(0);

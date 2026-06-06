/**
 * Gate QA: % pool FDC vuoti per dieta×branch (soglia <5% slot vuoti su scenari load).
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { FDC_BRANCH_POOL_SPECS } from "../lib/nutrition/v2/fdc-pool-specs";
import { queryFdcBranchPool } from "../lib/nutrition/v2/fdc-branch-query";
import type { FdcDietProfileTag } from "@empathy/contracts";

function loadEnvFile(filePath: string, override = false) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!override && key in process.env) continue;
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value.replace(/\\n/g, "").trim();
  }
}

const root = path.resolve(__dirname, "../../..");
loadEnvFile(path.join(root, ".env.local"), false);
loadEnvFile(path.join(root, "apps", "web", ".env.local"), true);

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "").trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
const admin = createClient(url, key, { auth: { persistSession: false } });

/** Gate produzione: diete primarie + pool pasti (fueling opzionale finché tag sport incompleti). */
const GATE_DIETS: FdcDietProfileTag[] = ["mediterranean", "omnivore"];
const OPTIONAL_DIETS: FdcDietProfileTag[] = ["vegan", "celiac"];
const OPTIONAL_POOLS = new Set(["fueling"]);

async function main() {
  let empty = 0;
  let total = 0;
  console.log("\n=== FDC pool QA ===\n");
  for (const diet of [...GATE_DIETS, ...OPTIONAL_DIETS]) {
    for (const spec of FDC_BRANCH_POOL_SPECS) {
      const hits = await queryFdcBranchPool(admin, { ...spec.filter, dietProfile: diet });
      const ok = hits.length > 0;
      const isGate = GATE_DIETS.includes(diet) && !OPTIONAL_POOLS.has(spec.poolKey);
      if (isGate) {
        total += 1;
        if (!ok) empty += 1;
      }
      const label = isGate ? (ok ? "OK" : "EMPTY") : ok ? "ok" : "warn";
      console.log(`${label} · ${diet} · ${spec.poolKey}: ${hits.length} candidati`);
    }
  }
  const pct = total > 0 ? (empty / total) * 100 : 0;
  console.log(`\nGate vuoti: ${empty}/${total} (${pct.toFixed(1)}%) — solo mediterranean/omnivore, pool pasti`);
  if (pct > 5) {
    console.error("FAIL: soglia 5% superata sul gate");
    process.exit(1);
  }
  console.log("PASS: pool coverage gate entro soglia\n");
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});

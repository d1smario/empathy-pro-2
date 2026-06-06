/**
 * Diagnostica allineamento progetto Supabase (URL vs service_role JWT ref) + test insert.
 * Non stampa segreti, solo host e ref progetto.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

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

function projectRefFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    const m = host.match(/^([a-z0-9]+)\.supabase\.co$/i);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

function projectRefFromJwt(jwt: string): string | null {
  const parts = jwt.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as { ref?: string };
    return payload.ref ?? null;
  } catch {
    try {
      const payload = JSON.parse(Buffer.from(parts[1]!, "base64").toString("utf8")) as { ref?: string };
      return payload.ref ?? null;
    } catch {
      return null;
    }
  }
}

const root = path.resolve(__dirname, "../../..");
loadEnvFile(path.join(root, ".env.local"), false);
loadEnvFile(path.join(root, "apps", "web", ".env.local"), true);
loadEnvFile(path.join(root, ".env.vercel.migrate.local"), false);

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "").trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

if (!url || !key) {
  console.error("Mancano NEXT_PUBLIC_SUPABASE_URL e/o SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local");
  process.exit(1);
}

const urlRef = projectRefFromUrl(url);
const jwtRef = projectRefFromJwt(key);

console.log(`URL host: ${new URL(url).host}`);
console.log(`Project ref (URL): ${urlRef ?? "?"}`);
console.log(`Project ref (JWT): ${jwtRef ?? "?"}`);
console.log(`Allineati: ${urlRef && jwtRef && urlRef === jwtRef ? "SÌ" : "NO — questa è la causa tipica del count 163"}`);

async function main() {
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const { count: before } = await admin.from("nutrition_fdc_foods").select("fdc_id", { count: "exact", head: true });
  console.log(`Count prima: ${before ?? "?"}`);

  const probeId = 999999001;
  const testRow = {
    fdc_id: probeId,
    description: "EMPATHY FDC import probe",
    data_type: "probe",
    kcal_100g: 1,
    carbs_100g: 0,
    protein_100g: 0,
    fat_100g: 0,
    source_payload: { probe: true },
    refreshed_at: new Date().toISOString(),
  };

  const ins = await admin.from("nutrition_fdc_foods").upsert([testRow], { onConflict: "fdc_id" });
  if (ins.error) {
    console.error("Test upsert FAIL:", ins.error.message);
    process.exit(1);
  }

  const { data: readBack } = await admin.from("nutrition_fdc_foods").select("fdc_id").eq("fdc_id", probeId).maybeSingle();
  console.log(`Test upsert probe ${probeId}: ${readBack ? "visibile" : "NON visibile"}`);

  const { count: after } = await admin.from("nutrition_fdc_foods").select("fdc_id", { count: "exact", head: true });
  console.log(`Count dopo probe: ${after ?? "?"}`);

  await admin.from("nutrition_fdc_foods").delete().eq("fdc_id", probeId);
}

void main();

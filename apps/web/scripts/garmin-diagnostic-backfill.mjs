/**
 * Probe Summary Backfill verso Garmin (stesso tipo di GET di Empathy `/api/.../backfill`).
 * Legge `.env.local` (path opzionale), risolve Bearer via Supabase → garmin_athlete_links + refresh Garmin.
 *
 * Usage (da `apps/web`, PowerShell — SOLO UUID atleta Empathy, mai `KEY=value`):
 *   node scripts/garmin-diagnostic-backfill.mjs <athlete_uuid> [stream] [days]
 *
 * Lo stream sonno si chiama `sleeps` (non `sleep`). Client ID Garmin va in `.env.local`, non sulla riga di comando.
 *
 * ENV richiesto in `.env.local`:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - GARMIN_OAUTH2_CLIENT_ID, GARMIN_OAUTH2_CLIENT_SECRET
 *
 * Su Windows NON usiamo process.exit() dopo fetch/Supabase (crash libuv uv_async); usiamo solo process.exitCode.
 * Altro progetto Supabase vs apps/web/.env.local: PowerShell `$env:GARMIN_DIAG_SUPERSEDE_ENV=".env.vercel.production"` (path relativo alla root repo).
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const TOKEN_URL = "https://diauth.garmin.com/di-oauth2-service/oauth/token";
const WELLNESS = "https://apis.garmin.com/wellness-api";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeEnvValue(raw) {
  let v = raw.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  /** Alcuni `.env` hanno `\n` letterale nell'host — rompe gli URL */
  return v.replace(/[\r\n]+/g, "").trim();
}

function loadEnvFiles(paths) {
  for (const p of paths) {
    if (!p || !existsSync(p)) continue;
    const text = readFileSync(p, "utf8");
    for (let line of text.split(/\r?\n/)) {
      line = line.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      const val = normalizeEnvValue(line.slice(eq + 1));
      if (!(key in process.env) || process.env[key] === "") {
        process.env[key] = val;
      }
    }
  }
}

/** Come loadEnv ma sovrascrive sempre le chiavi presenti nel file */
function loadEnvFilesOverride(paths) {
  for (const p of paths) {
    if (!p || !existsSync(p)) continue;
    const text = readFileSync(p, "utf8");
    for (let line of text.split(/\r?\n/)) {
      line = line.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      const val = normalizeEnvValue(line.slice(eq + 1));
      process.env[key] = val;
    }
  }
}

function parseGarminErrorMessage(raw) {
  const t = raw.trim();
  if (!t.startsWith("{")) return undefined;
  try {
    const o = JSON.parse(t);
    const m = o?.errorMessage;
    return typeof m === "string" ? m.trim() : undefined;
  } catch {
    return undefined;
  }
}

async function refreshGarmin(refreshToken, clientId, clientSecret) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`refresh HTTP ${res.status}: ${text.slice(0, 600)}`);
  }
  const j = JSON.parse(text);
  if (typeof j.access_token !== "string") throw new Error("refresh: access_token mancante");
  return j;
}

function fail(msg) {
  console.error(msg);
  process.exitCode = 1;
  return false;
}

async function main() {
  const argv = process.argv.slice(2);
  const athleteId = (argv[0] ?? "").trim();
  const stream = (argv[1] ?? "dailies").trim();
  const daysRaw = argv[2] ?? "14";
  const days = Math.min(365, Math.max(1, Math.floor(Number(daysRaw)) || 14));

  const envPrimary = resolve(__dirname, "../.env.local");
  const envRoot = resolve(__dirname, "../../../.env.local");
  loadEnvFiles([envPrimary, envRoot, process.env.GARMIN_ENV_FILE ? resolve(process.cwd(), process.env.GARMIN_ENV_FILE) : null]);

  const superPathRaw = process.env.GARMIN_DIAG_SUPERSEDE_ENV?.trim();
  if (superPathRaw) {
    const superPath =
      /^[a-z]:[\\/]/i.test(superPathRaw) || superPathRaw.startsWith("\\\\") || superPathRaw.startsWith("/")
        ? superPathRaw
        : resolve(__dirname, "../../../", superPathRaw);
    if (existsSync(superPath)) {
      loadEnvFilesOverride([superPath]);
      console.error(`(diag) Override env caricato da: ${superPath}`);
    } else {
      console.error("(diag) GARMIN_DIAG_SUPERSEDE_ENV: file non trovato:", superPath);
    }
  }

  if (!athleteId) {
    return fail(
      "Uso (PowerShell):\n" +
        '  node scripts/garmin-diagnostic-backfill.mjs "UUID-ATLETA-EMPATHY" dailies 14\n' +
        "Il primo argomento è l'athlete_id dalla tabella garmin_athlete_links (NON il GARMIN_OAUTH2_CLIENT_ID).\n" +
        '  $env:GARMIN_DIAG_SUPERSEDE_ENV=".env.vercel.production"   # se il DB diverso è in quel file\n' +
        "Stream sonno: sleeps   (non sleep).",
    );
  }

  if (athleteId.includes("=")) {
    return fail(
      "Il primo argomento non deve essere KEY=value (es. GARMIN_OAUTH2_CLIENT_ID=...).\n" +
        "Metti GARMIN_OAUTH2_CLIENT_ID nel file apps/web/.env.local e passa solo UUID atleta, es.:\n" +
        '  node scripts/garmin-diagnostic-backfill.mjs "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" dailies 14',
    );
  }

  if (!UUID_RE.test(athleteId)) {
    return fail(
      `athlete_id non sembra un UUID: "${athleteId.slice(0, 60)}..."\n` +
        "Usa l'UUID atleta Empathy (profilo / Supabase garmin_athlete_links.athlete_id).",
    );
  }

  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const clientId = process.env.GARMIN_OAUTH2_CLIENT_ID?.trim();
  const clientSecret = process.env.GARMIN_OAUTH2_CLIENT_SECRET?.trim();

  const missing = [sbUrl, sbKey, clientId, clientSecret].some((x) => !x);
  if (missing) {
    return fail(
      "Manca env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / GARMIN_OAUTH2_CLIENT_ID / GARMIN_OAUTH2_CLIENT_SECRET\n" +
        `(letti da: ${envPrimary} o ${envRoot})`,
    );
  }

  const sb = createClient(sbUrl, sbKey, {
    auth: { persistSession: false, autoRefreshSession: false },
  });

  const { data: row, error } = await sb
    .from("garmin_athlete_links")
    .select("oauth_access_token,oauth_refresh_token,token_expires_at")
    .eq("athlete_id", athleteId)
    .maybeSingle();

  if (error) {
    return fail(`Supabase: ${error.message}`);
  }

  if (!row?.oauth_refresh_token?.trim()) {
    console.error(
      `Nessun collegamento Garmin per athlete_id=${athleteId} (tabella garmin_athlete_links vuota per questo id oppure oauth_refresh_token assente).`,
    );

    const host = (() => {
      try {
        return new URL(sbUrl).host;
      } catch {
        return "<URL non valido>";
      }
    })();
    console.error(`Progetto Supabase (host): ${host} — deve coincidere con quello usato dall'app deployata.`);

    const { count: nLinks, error: countErr } = await sb.from("garmin_athlete_links").select("athlete_id", { count: "exact", head: true });
    if (countErr) {
      console.error("Conteggio garmin_athlete_links fallito:", countErr.message);
    } else {
      console.error(`Righe totali in garmin_athlete_links: ${nLinks ?? 0}`);
    }

    const { data: hints, error: hintErr } = await sb.from("garmin_athlete_links").select("athlete_id").limit(12);
    if (hintErr) {
      console.error("Lettura garmin_athlete_links fallita:", hintErr.message);
    } else if (hints?.length) {
      console.error("athlete_id (id in athlete_profiles) con Garmin collegato in questo DB — usa uno di questi nello script:");
      for (const h of hints) {
        console.error(`  ${h.athlete_id}`);
      }
      console.error(
        "Se il tuo UUID non è tra questi: o non è athlete_profiles.id, o stai usando un altro progetto Supabase.",
      );
    } else {
      console.error("Tabella garmin_athlete_links vuota in questo progetto. Collega Garmin da Profilo sull'app che punta a QUESO Supabase, oppure fixa NEXT_PUBLIC_SUPABASE_URL in .env.local.");
    }

    if (stream === "sleep") {
      console.error('Nota: per il sonno lo stream backfill si chiama "sleeps", non "sleep".');
    }

    process.exitCode = 1;
    return false;
  }

  let accessToken = (row.oauth_access_token ?? "").trim();
  const expMs = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0;
  const skewMs = 5 * 60 * 1000;
  if (!accessToken || !Number.isFinite(expMs) || expMs <= Date.now() + skewMs) {
    console.error("Aggiorno access token Garmin (refresh)…");
    const tokens = await refreshGarmin(row.oauth_refresh_token.trim(), clientId, clientSecret);
    accessToken = tokens.access_token;
    const expiresAt = new Date(Date.now() + Math.max(60, (tokens.expires_in ?? 3600) - 600) * 1000).toISOString();
    const rtExp =
      typeof tokens.refresh_token_expires_in === "number" && Number.isFinite(tokens.refresh_token_expires_in)
        ? new Date(Date.now() + tokens.refresh_token_expires_in * 1000).toISOString()
        : null;

    await sb
      .from("garmin_athlete_links")
      .update({
        oauth_access_token: tokens.access_token,
        oauth_refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt,
        oauth_refresh_expires_at: rtExp,
        updated_at: new Date().toISOString(),
      })
      .eq("athlete_id", athleteId);
    console.error("Refresh OK.");
  }

  const endSec = Math.floor(Date.now() / 1000);
  const startSec = endSec - days * 86_400;
  const span = endSec - startSec;
  const maxSpan = 90 * 86_400;
  const effStart = span > maxSpan ? endSec - maxSpan : startSec;

  const u = new URL(`${WELLNESS}/rest/backfill/${encodeURIComponent(stream)}`);
  u.searchParams.set("summaryStartTimeInSeconds", String(effStart));
  u.searchParams.set("summaryEndTimeInSeconds", String(endSec));

  console.error(
    `GET ${stream} backfill (${days} giorni richiesti; start effettivo UNIX ${effStart}${span > maxSpan ? " — clamp ~90 giorni Garmin" : ""})`,
  );

  const res = await fetch(u.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await res.text();
  const errMsg = parseGarminErrorMessage(text);

  console.log(JSON.stringify({ httpStatus: res.status, stream, diagnostics: errMsg ?? null }, null, 2));
  console.error("----- Corpo Garmin (truncate 4000) -----");
  console.error(text.slice(0, 4000));

  if (res.status >= 400) {
    process.exitCode = 1;
  }
  return true;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

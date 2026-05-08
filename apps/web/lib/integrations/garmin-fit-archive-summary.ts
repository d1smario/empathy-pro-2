import "server-only";

import { gunzipSync } from "node:zlib";

import FitParser from "fit-file-parser";

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** FIT activity vs workout: prendiamo campi sintetici per indice/ricerca senza serializzare tutti i record. */
async function summarizeFitBuffer(buffer: Buffer): Promise<Record<string, unknown>> {
  const parser = new FitParser({
    force: true,
    mode: "list",
    speedUnit: "km/h",
    lengthUnit: "m",
    temperatureUnit: "celsius",
    elapsedRecordField: true,
  });
  const fitRaw = await parser.parseAsync(Uint8Array.from(buffer).buffer as ArrayBuffer);
  const fit =
    fitRaw && typeof fitRaw === "object" ? (fitRaw as unknown as Record<string, unknown>) : {};
  const records = Array.isArray(fit.records) ? (fit.records as Record<string, unknown>[]) : [];
  const sessions = Array.isArray(fit.sessions) ? (fit.sessions as Record<string, unknown>[]) : [];
  const activities = Array.isArray(fit.activities) ? (fit.activities as Record<string, unknown>[]) : [];

  const s0 = sessions[0] ?? {};
  const a0 = activities[0] ?? {};
  const sport =
    asNumber(s0.sport) ?? asNumber(a0.sport) ?? asNumber(a0.activity_type ?? a0.activityType);
  const totalMs =
    asNumber(s0.total_elapsed_time) ?? asNumber(s0.total_timer_time) ?? asNumber(a0.total_timer_time);
  const start =
    typeof s0.start_time === "string"
      ? s0.start_time
      : typeof a0.timestamp === "string"
        ? a0.timestamp
        : null;

  return {
    parse_ok: true as const,
    parser: "fit-file-parser@list",
    session_count: sessions.length,
    activity_count: activities.length,
    record_count: records.length,
    sport: sport ?? null,
    total_elapsed_seconds: totalMs != null ? Math.round(totalMs) : null,
    session_start_hint: typeof start === "string" ? start : null,
  };
}

export function looksLikeGarminFitBytes(buffer: Buffer): boolean {
  if (buffer.length < 14) return false;
  /** Protocol header .FIT alla fine delle prime dimensioni dichiarate (SDK Garmin). Sufficienza sul tail. */
  const tail = buffer.subarray(Math.max(0, buffer.length - 8)).toString("latin1");
  return tail.includes(".FIT");
}

export function looksLikeGzipGarminArtifact(buffer: Buffer): boolean {
  return buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
}

/**
 * Best-effort: gzipped FIT da Connect, poi parse. Errori racchiusi in JSON compatto per la colonna fit_extract.
 */
export async function tryExtractGarminActivityFitArchiveSummary(buffer: Buffer): Promise<Record<string, unknown>> {
  let work = buffer;
  if (buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
    try {
      work = Buffer.from(gunzipSync(buffer));
    } catch {
      return { parse_ok: false as const, error: "gzip_unpack_failed" };
    }
  }
  if (!looksLikeGarminFitBytes(work)) {
    return { parse_ok: false as const, error: "not_fit_signature" };
  }
  try {
    return await summarizeFitBuffer(work);
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 500) : "parse_failed";
    return { parse_ok: false as const, error: msg };
  }
}

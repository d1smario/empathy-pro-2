import "server-only";

import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { readOptionalGarminActivityBlobsBucket } from "@/lib/supabase-env";

import {
  looksLikeGarminFitBytes,
  looksLikeGzipGarminArtifact,
  tryExtractGarminActivityFitArchiveSummary,
} from "@/lib/integrations/garmin-fit-archive-summary";

export function inferGarminBinaryWithoutContentType(buf: Buffer): boolean {
  if (!buf.length) return false;
  if (looksLikeGzipGarminArtifact(buf)) return true;
  if (looksLikeGarminFitBytes(buf)) return true;
  const head = buf.subarray(0, Math.min(256, buf.length)).toString("utf8").trimStart();
  if (head.startsWith("<?xml") || head.startsWith("<TrainingCenterDatabase"))
    return true;
  if (head.startsWith("<gpx") || head.includes("<gpx "))
    return true;
  return false;
}

/** Quando Garmin omette `Content-Type` su 200 octet‑stream‑like. */
export function shouldTreatGarminPullResponseAsBinary(
  httpOk: boolean,
  hdrCt: string | null | undefined,
  buf: Buffer,
): boolean {
  if (!httpOk || !buf.length) return false;
  const trimmed = hdrCt?.trim();
  if (trimmed?.length) return garminPullBinaryMimeKind(trimmed);
  return inferGarminBinaryWithoutContentType(buf);
}

export function garminPullBinaryMimeKind(contentType: string): boolean {
  const lower = contentType.toLowerCase();
  if (lower.includes("json")) return false;
  if (lower.includes("octet-stream")) return true;
  if (lower.includes("application/vnd.garmin") && !lower.includes("json")) return true;
  if (lower.includes("text/xml") || lower.includes("application/xml")) return true;
  if (lower.includes("application/gpx+xml")) return true;
  if (lower.includes("gzip") || lower.includes("application/x-gzip")) return true;
  return false;
}

function sanitizePathSegment(seg: string, fallback: string): string {
  const s = seg.replace(/[^\w\-]+/g, "_").slice(0, 200);
  return s.length > 0 ? s : fallback;
}

function filenameFromContentDisposition(cd: string | null): string | null {
  if (!cd) return null;
  const star = cd.match(/filename\*\s*=\s*UTF-8''([^;\s]+)/i);
  if (star?.[1]) return decodeURIComponent(star[1].replace(/^"+|"+$/g, ""));
  const plain = cd.match(/filename\s*=\s*("([^"]+)"|([^;\s]+))/i);
  const raw = plain?.[2] ?? plain?.[3];
  if (!raw) return null;
  return raw.replace(/^"+|"+$/g, "");
}

/** Estensione file per archiviazione (FIT/TCX/GPX/XML/bin). */
export function guessGarminArchivedExtension(params: {
  callbackUrl: string;
  contentType: string;
  contentDisposition: string | null;
}): string {
  const fromCd = filenameFromContentDisposition(params.contentDisposition);
  if (fromCd) {
    const dot = fromCd.lastIndexOf(".");
    if (dot >= 0 && dot < fromCd.length - 1) {
      const ext = fromCd.slice(dot).toLowerCase();
      if (ext.match(/^\.[a-z0-9]{1,8}$/)) return ext.startsWith(".") ? ext : `.${ext}`;
    }
  }

  try {
    const u = new URL(params.callbackUrl);
    const ft = u.searchParams.get("fileType") ?? u.searchParams.get("format");
    if (ft) {
      const f = ft.toLowerCase();
      if (f === "fit") return ".fit";
      if (f === "tcx") return ".tcx";
      if (f === "gpx") return ".gpx";
    }
  } catch {
    /* ignore */
  }

  const ct = params.contentType.toLowerCase();
  if (ct.includes("gpx")) return ".gpx";
  if (ct.includes("tcx")) return ".tcx";
  if (ct.includes("xml")) return ".xml";
  if (ct.includes("gzip") || ct.includes("x-gzip")) return ".gz";
  if (ct.includes("octet-stream") || ct.includes("vnd.garmin.fit")) return ".fit";
  return ".bin";
}

export type GarminBlobPersistResult =
  | {
      stored: true;
      bucket: string;
      path: string;
      sha256_hex: string;
      byte_length: number;
      extension: string;
      upload_content_type: string;
      row_id?: string;
      fit_extract?: Record<string, unknown> | null;
    }
  | { stored: false; reason: string };

/**
 * Upload blob + INSERT in garmin_pull_binary_objects. Richiede tabella migrazione 046 e bucket configurato.
 */
export async function persistGarminPullBinaryToStorage(params: {
  supabase: SupabaseClient;
  pullJobId: string;
  athleteId: string | null;
  endpointKind: string;
  callbackUrl: string;
  buffer: Buffer;
  contentType: string | null;
  contentDispositionHeader: string | null;
}): Promise<GarminBlobPersistResult> {
  const bucket = readOptionalGarminActivityBlobsBucket();
  if (!bucket) {
    return {
      stored: false,
      reason: "GARMIN_ACTIVITY_BLOBS_BUCKET non impostato: creare il bucket da migrazione 046 e la variabile d'ambiente.",
    };
  }

  const ct = params.contentType?.trim() || "application/octet-stream";
  const ext = guessGarminArchivedExtension({
    callbackUrl: params.callbackUrl,
    contentType: ct,
    contentDisposition: params.contentDispositionHeader,
  });
  const sha256 = createHash("sha256").update(params.buffer).digest("hex");

  let fitExtract: Record<string, unknown> | null = null;
  if (
    ext === ".fit" ||
    ext === ".gz" ||
    ct.includes("octet-stream") ||
    ct.includes("fit") ||
    looksLikeGarminFitBytes(params.buffer) ||
    looksLikeGzipGarminArtifact(params.buffer)
  ) {
    fitExtract = await tryExtractGarminActivityFitArchiveSummary(params.buffer);
  }

  const athSeg = sanitizePathSegment(params.athleteId ?? "unmapped", "unmapped");

  /** Path deterministico dedup naturale solo su job UUID (Garmin usa un GET per blob). */
  const objectPath = `garmin/${athSeg}/${params.pullJobId}/${sha256.slice(0, 16)}${ext}`;

  const { error: upErr } = await params.supabase.storage.from(bucket).upload(objectPath, params.buffer, {
    contentType: ct,
    upsert: false,
  });
  if (upErr) return { stored: false, reason: `storage_upload: ${upErr.message}` };

  const { data: inserted, error: insErr } = await params.supabase
    .from("garmin_pull_binary_objects")
    .insert({
      pull_job_id: params.pullJobId,
      athlete_id: params.athleteId ?? null,
      storage_bucket: bucket,
      storage_path: objectPath,
      content_type: ct,
      byte_length: params.buffer.length,
      sha256_hex: sha256,
      extension: ext,
      endpoint_kind: params.endpointKind.slice(0, 200),
      fit_extract: fitExtract,
    })
    .select("id")
    .single();

  if (insErr && (insErr as { code?: string }).code !== "23505") {
    return { stored: false, reason: `db_insert_garmin_pull_binary_objects: ${insErr.message}` };
  }

  return {
    stored: true,
    bucket,
    path: objectPath,
    sha256_hex: sha256,
    byte_length: params.buffer.length,
    extension: ext,
    upload_content_type: ct,
    row_id: (inserted as { id?: string } | null)?.id,
    fit_extract: fitExtract,
  };
}

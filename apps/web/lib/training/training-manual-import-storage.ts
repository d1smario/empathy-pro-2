import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { sanitizeHealthObjectName } from "@/lib/health/health-upload-storage";
import {
  readOptionalServiceRoleKey,
  readSupabasePublicUrl,
  readTrainingManualImportsBucket,
} from "@/lib/supabase-env";

/** Limite bucket (migrazione 049) in byte — allineare se si alza `file_size_limit` nel SQL. */
export const TRAINING_MANUAL_IMPORT_MAX_BYTES = 52_428_800; // 50 MiB

/** Sotto questa soglia l’upload multipart verso `/api/training/import` resta ok su Vercel (~4.5 MB tetto). */
export const TRAINING_IMPORT_VERCEL_SAFE_MULTIPART_BYTES = 3 * 1024 * 1024;

const ALLOWED_CT = new Set(
  [
    "application/octet-stream",
    "application/gzip",
    "application/x-gzip",
    "application/vnd.garmin.fit",
    "text/xml",
    "application/xml",
    "application/gpx+xml",
    "application/tcx+xml",
    "text/csv",
    "application/json",
    "text/plain",
    "",
  ].map((s) => s.toLowerCase()),
);

export function sanitizeTrainingManualStagingObjectName(fileName: string): string {
  return sanitizeHealthObjectName(fileName);
}

export function isAllowedTrainingManualImportContentType(contentType: string): boolean {
  const t = contentType.trim().toLowerCase();
  return ALLOWED_CT.has(t);
}

export function createSupabaseServiceRoleClient(): SupabaseClient | null {
  const key = readOptionalServiceRoleKey();
  if (!key?.trim()) return null;
  return createClient(readSupabasePublicUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function trainingManualImportsBucketId(): string {
  return readTrainingManualImportsBucket();
}

/** `objectPath` deve essere `${athleteId}/…` per evitare letture cross-atleta. */
export function assertTrainingManualStagingPathForAthlete(input: {
  athleteId: string;
  objectPath: string;
}): void {
  const prefix = `${input.athleteId.trim()}/`;
  const p = input.objectPath.trim();
  if (!p.startsWith(prefix)) {
    throw new Error("storage_path_not_owned_by_athlete");
  }
}

export async function downloadTrainingManualStagingObject(input: {
  supabase: SupabaseClient;
  bucket: string;
  objectPath: string;
}): Promise<{ buffer: Buffer; contentType: string | null }> {
  const dl = await input.supabase.storage.from(input.bucket).download(input.objectPath);
  if (dl.error) {
    throw new Error(dl.error.message || "storage_download_failed");
  }
  const blob = dl.data;
  const buf = Buffer.from(await blob.arrayBuffer());
  const contentType = typeof blob.type === "string" && blob.type.trim() ? blob.type : null;
  return { buffer: buf, contentType };
}

export async function removeTrainingManualStagingObjectBestEffort(input: {
  supabase: SupabaseClient;
  bucket: string;
  objectPath: string;
}): Promise<void> {
  try {
    await input.supabase.storage.from(input.bucket).remove([input.objectPath]);
  } catch {
    // best-effort cleanup
  }
}

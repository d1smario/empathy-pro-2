import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { sanitizeHealthObjectName } from "@/lib/health/health-upload-storage";
import { readOptionalServiceRoleKey, readSupabasePublicUrl } from "@/lib/supabase-env";

export const BIOMECH_CAPTURE_BUCKET = "biomech-capture" as const;
export const BIOMECH_CAPTURE_MAX_BYTES = 524_288_000; // 500 MiB, migration 021

const ALLOWED_CT = new Set(
  ["video/mp4", "video/quicktime", "image/jpeg", "image/png", "image/webp"].map((value) => value.toLowerCase()),
);

export function createBiomechServiceRoleClient(): SupabaseClient | null {
  const key = readOptionalServiceRoleKey();
  if (!key?.trim()) return null;
  return createClient(readSupabasePublicUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function sanitizeBiomechCaptureObjectName(fileName: string): string {
  return sanitizeHealthObjectName(fileName);
}

export function isAllowedBiomechCaptureContentType(contentType: string): boolean {
  return ALLOWED_CT.has(contentType.trim().toLowerCase());
}

export function assertBiomechCapturePathForAthlete(input: { athleteId: string; objectPath: string }): void {
  const prefix = `${input.athleteId.trim()}/`;
  const objectPath = input.objectPath.trim();
  if (!objectPath.startsWith(prefix)) {
    throw new Error("storage_path_not_owned_by_athlete");
  }
}

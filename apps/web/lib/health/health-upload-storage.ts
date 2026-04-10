import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { readOptionalHealthUploadsBucket } from "@/lib/supabase-env";

export function getHealthUploadsBucket(): string | null {
  return readOptionalHealthUploadsBucket();
}

export function sanitizeHealthObjectName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "upload";
  const cleaned = base.replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_");
  return cleaned.length > 0 ? cleaned.slice(0, 200) : "upload.bin";
}

export async function uploadHealthObject(
  supabase: SupabaseClient,
  bucket: string,
  objectPath: string,
  buffer: Buffer,
  contentType: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.storage.from(bucket).upload(objectPath, buffer, {
    contentType: contentType || "application/octet-stream",
    upsert: true,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

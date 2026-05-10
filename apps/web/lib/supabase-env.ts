/**
 * Normalizza valori da `.env` / Vercel: spazi, newline, virgolette copiate per sbaglio.
 * "Invalid API key" spesso arriva da chiavi troncate o con caratteri extra.
 */
export function normalizeSupabaseEnvValue(raw: string): string {
  let v = raw.trim();
  v = v.replace(/\r\n/g, "").replace(/\n/g, "").trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

export function readSupabasePublicUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw?.trim()) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  return normalizeSupabaseEnvValue(raw);
}

export function readSupabaseAnonKey(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!raw?.trim()) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return normalizeSupabaseEnvValue(raw);
}

/** Service role / secret: solo server; assente → le route usano anon (RLS). */
export function readOptionalServiceRoleKey(): string | null {
  const raw = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!raw?.trim()) return null;
  const key = normalizeSupabaseEnvValue(raw);
  return key.length > 0 ? key : null;
}

/** Bucket Storage per PDF esami Health (opzionale). */
export function readOptionalHealthUploadsBucket(): string | null {
  const raw = process.env.HEALTH_UPLOADS_BUCKET;
  if (!raw?.trim()) return null;
  const name = normalizeSupabaseEnvValue(raw);
  return name.length > 0 ? name : null;
}

/** Bucket Storage per FIT/XML da pull Garmin (migrazione 046); opzionale finché non serve archiviazione blob. */
export function readOptionalGarminActivityBlobsBucket(): string | null {
  const raw = process.env.GARMIN_ACTIVITY_BLOBS_BUCKET;
  if (!raw?.trim()) return null;
  const name = normalizeSupabaseEnvValue(raw);
  return name.length > 0 ? name : null;
}

/** Bucket staging import manuale Training (migrazione 049); default allineato al bucket creato in SQL. */
export function readTrainingManualImportsBucket(): string {
  const raw = process.env.TRAINING_MANUAL_IMPORTS_BUCKET;
  if (raw?.trim()) {
    const name = normalizeSupabaseEnvValue(raw);
    if (name.length > 0) return name;
  }
  return "empathy_training_manual_imports";
}

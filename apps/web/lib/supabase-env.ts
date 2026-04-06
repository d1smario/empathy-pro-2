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

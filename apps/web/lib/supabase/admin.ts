import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client service role (solo route server). Bypass RLS: usare solo dopo aver verificato l’utente (cookie).
 * `null` se manca `SUPABASE_SERVICE_ROLE_KEY`.
 */
export function createSupabaseAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  readOptionalServiceRoleKey,
  readSupabaseAnonKey,
  readSupabasePublicUrl,
} from "@/lib/supabase-env";

/** Client Supabase per processi Node (script ingest, worker) senza dipendere da `supabase-server` / `server-only`. */
export function createNodeSupabaseServicePreferred(): SupabaseClient {
  const supabaseUrl = readSupabasePublicUrl();
  const serviceRoleKey = readOptionalServiceRoleKey();
  const anonKey = readSupabaseAnonKey();
  const key = serviceRoleKey ?? anonKey;
  return createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

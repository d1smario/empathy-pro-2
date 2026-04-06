import "server-only";

import { createClient } from "@supabase/supabase-js";
import {
  readOptionalServiceRoleKey,
  readSupabaseAnonKey,
  readSupabasePublicUrl,
} from "./supabase-env";

/**
 * Client server per query dati atleti dopo auth verificata.
 * Preferisce service role se presente; altrimenti anon (RLS).
 */
export function createServerSupabaseClient() {
  const supabaseUrl = readSupabasePublicUrl();
  const anonKey = readSupabaseAnonKey();
  const serviceRoleKey = readOptionalServiceRoleKey();
  const key = serviceRoleKey ?? anonKey;
  return createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createRequestSupabaseClient(accessToken: string) {
  const supabaseUrl = readSupabasePublicUrl();
  const anonKey = readSupabaseAnonKey();
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

import "server-only";

import { createClient } from "@supabase/supabase-js";

import { createNodeSupabaseServicePreferred } from "@/lib/supabase-node-client";
import { readSupabaseAnonKey, readSupabasePublicUrl } from "@/lib/supabase-env";

/**
 * Client server per query dati atleti dopo auth verificata.
 * Preferisce service role se presente; altrimenti anon (RLS).
 */
export function createServerSupabaseClient() {
  return createNodeSupabaseServicePreferred();
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

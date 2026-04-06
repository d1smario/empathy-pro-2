"use client";

import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";

/**
 * Header come V1 `training-write-api`: Bearer dalla sessione Supabase browser.
 * Necessario quando il cookie da solo non basta per le route server (parità con `nextjs-empathy-pro`).
 */
export async function buildSupabaseAuthHeaders(base?: HeadersInit): Promise<Headers> {
  const headers = new Headers(base);
  const supabase = createEmpathyBrowserSupabase();
  if (!supabase) return headers;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token?.trim();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
      return headers;
    }
    await new Promise((r) => setTimeout(r, 120 + attempt * 80));
  }
  return headers;
}

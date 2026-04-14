"use client";

import { supabase } from "@/lib/supabase";
import { createEmpathyBrowserSupabase } from "@/lib/supabase/browser";

function appendHeaders(target: Headers, source?: HeadersInit) {
  if (!source) return;
  const incoming = new Headers(source);
  incoming.forEach((value, key) => {
    target.set(key, value);
  });
}

/**
 * Stessa sorgente sessione di `useActiveAthlete` / `POST /api/access/ensure-profile`:
 * client SSR cookie (`createBrowserClient`). Il singleton `lib/supabase` non legge quei cookie → 401 sulle API con Bearer.
 */
async function readStableAccessToken(attempts = 4): Promise<string | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
    return null;
  }
  const safeAttempts = Math.max(1, attempts);
  const browserSsr = typeof window !== "undefined" ? createEmpathyBrowserSupabase() : null;
  for (let index = 0; index < safeAttempts; index += 1) {
    const client = browserSsr ?? supabase;
    const { data } = await client.auth.getSession();
    const token = data.session?.access_token?.trim() ?? null;
    if (token) return token;
    await new Promise((resolve) => setTimeout(resolve, 120 + index * 80));
  }
  return null;
}

export async function buildSupabaseAuthHeaders(
  base?: HeadersInit,
  options?: { accessToken?: string | null },
): Promise<Headers> {
  const headers = new Headers();
  appendHeaders(headers, base);
  const token = options?.accessToken?.trim() || (await readStableAccessToken());
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

import "server-only";

import { ensureWahooAccessToken } from "@/lib/integrations/wahoo-access-token";
import { wahooApiBaseUrl } from "@/lib/integrations/wahoo-oauth2-api";

export type WahooJsonResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; bodySnippet?: string };

function joinPath(base: string, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base.replace(/\/$/, "")}${p}`;
}

/** application/x-www-form-urlencoded come da esempi curl Wahoo Cloud. */
export async function wahooCloudRequestForm(input: {
  athleteId: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  /** Chiavi già nel formato `plan[file]` o `workout[name]`. Valori stringa (URL-encoded). */
  fields?: Record<string, string>;
}): Promise<WahooJsonResult<unknown>> {
  const token = await ensureWahooAccessToken(input.athleteId);
  const url = new URL(joinPath(wahooApiBaseUrl(), input.path));
  const body =
    input.fields && Object.keys(input.fields).length > 0
      ? new URLSearchParams(input.fields).toString()
      : undefined;

  const res = await fetch(url.toString(), {
    method: input.method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: input.method === "GET" || input.method === "DELETE" ? undefined : body,
    cache: "no-store",
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    return {
      ok: false,
      status: res.status,
      error: "wahoo_response_non_json",
      bodySnippet: text.slice(0, 400),
    };
  }

  if (!res.ok) {
    const errObj = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
    const msg =
      (typeof errObj?.error === "string" && errObj.error) ||
      (typeof errObj?.message === "string" && errObj.message) ||
      `wahoo_http_${res.status}`;
    return { ok: false, status: res.status, error: msg, bodySnippet: text.slice(0, 400) };
  }

  return { ok: true, status: res.status, data };
}

/** GET con query string (parametri semplici). */
export async function wahooCloudRequestGet(input: {
  athleteId: string;
  path: string;
  query?: Record<string, string | number | undefined>;
}): Promise<WahooJsonResult<unknown>> {
  const token = await ensureWahooAccessToken(input.athleteId);
  const url = new URL(joinPath(wahooApiBaseUrl(), input.path));
  if (input.query) {
    for (const [k, v] of Object.entries(input.query)) {
      if (v === undefined) continue;
      url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    return { ok: false, status: res.status, error: "wahoo_response_non_json", bodySnippet: text.slice(0, 400) };
  }
  if (!res.ok) {
    const errObj = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
    const msg =
      (typeof errObj?.error === "string" && errObj.error) ||
      (typeof errObj?.message === "string" && errObj.message) ||
      `wahoo_http_${res.status}`;
    return { ok: false, status: res.status, error: msg, bodySnippet: text.slice(0, 400) };
  }
  return { ok: true, status: res.status, data };
}

export function wahooPlanFileDataUrlFromJson(planJson: unknown): string {
  const raw = JSON.stringify(planJson);
  const b64 = Buffer.from(raw, "utf8").toString("base64");
  return `data:application/json;base64,${b64}`;
}

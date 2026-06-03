import { buildSupabaseAuthHeaders } from "@/lib/auth/client-auth";
import { fetchWithTimeout } from "@/lib/http/fetch-with-timeout";
import type { OperationalDayHubPayload } from "@/lib/operational/build-operational-day-hub";

export function isOperationalDayHubEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_DAY_HUB === "1";
}

export async function fetchOperationalDayHub(input: {
  athleteId: string;
  date: string;
}): Promise<OperationalDayHubPayload | { ok: false; error: string }> {
  const params = new URLSearchParams({
    athleteId: input.athleteId,
    date: input.date,
  });
  try {
    const res = await fetchWithTimeout(`/api/operational/day-hub?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
      headers: await buildSupabaseAuthHeaders({ "Content-Type": "application/json" }),
    });
    const json = (await res.json()) as OperationalDayHubPayload | { ok: false; error: string };
    if (!res.ok || !("ok" in json) || !json.ok) {
      return { ok: false, error: ("error" in json && json.error) || "day_hub_fetch_failed" };
    }
    return json;
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "day_hub_fetch_failed" };
  }
}

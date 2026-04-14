import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { readOptionalServiceRoleKey } from "@/lib/supabase-env";

function collectGarminUserIdsDeep(parsed: unknown): string[] {
  const out = new Set<string>();
  function walk(node: unknown): void {
    if (node == null) return;
    if (Array.isArray(node)) {
      for (const x of node) walk(x);
      return;
    }
    if (typeof node !== "object") return;
    const r = node as Record<string, unknown>;
    for (const k of ["userId", "user_id", "userUUID", "userUuid"]) {
      const v = r[k];
      if (typeof v === "string" && v.trim()) out.add(v.trim());
    }
    for (const v of Object.values(r)) walk(v);
  }
  walk(parsed);
  return [...out];
}

function isDeregistrationEndpointKind(kind: string): boolean {
  const k = kind.toLowerCase();
  return k.includes("deregist") || kind.toUpperCase().includes("DEREGISTER");
}

/**
 * Effetti lato server per webhook amministrativi Garmin (Partner Verification).
 * Deregistrazione: rimuove `garmin_athlete_links` per ogni `userId` nel payload.
 */
export async function runGarminPartnerAdminEffects(input: {
  endpointKind: string;
  parsedJson: unknown;
}): Promise<{ deregistrationRemoved: number }> {
  if (!isDeregistrationEndpointKind(input.endpointKind)) {
    return { deregistrationRemoved: 0 };
  }
  if (!readOptionalServiceRoleKey()) {
    return { deregistrationRemoved: 0 };
  }

  const ids = collectGarminUserIdsDeep(input.parsedJson);
  if (ids.length === 0) return { deregistrationRemoved: 0 };

  try {
    const supabase = createServerSupabaseClient();
    let removed = 0;
    for (const garminUserId of ids) {
      const { data, error } = await supabase
        .from("garmin_athlete_links")
        .delete()
        .eq("garmin_user_id", garminUserId)
        .select("id");
      if (!error && Array.isArray(data)) removed += data.length;
    }
    return { deregistrationRemoved: removed };
  } catch {
    return { deregistrationRemoved: 0 };
  }
}

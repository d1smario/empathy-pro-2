import "server-only";

import { ensureFreshGarminAccessTokenForAthlete } from "@/lib/integrations/garmin-access-token";
import { extractGarminUserPermissionsFromUnknown, fetchGarminUserPermissions } from "@/lib/integrations/garmin-oauth2-api";
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

function isUserPermissionsEndpointKind(kind: string): boolean {
  const k = kind.toLowerCase();
  return k.includes("userpermission") || k.includes("user-permission");
}

export type GarminPartnerAdminEffectsResult = {
  deregistrationRemoved: number;
  /** Righe `garmin_athlete_links` aggiornate con `user_permissions` (payload o GET). */
  userPermissionsSynced: number;
};

/**
 * Effetti lato server per webhook amministrativi Garmin (Partner Verification).
 * - Deregistrazione: rimuove `garmin_athlete_links` per ogni `userId` nel payload.
 * - User permissions: aggiorna `user_permissions` da JSON notifica o GET `/rest/user/permissions` (Bearer refresh).
 */
export async function runGarminPartnerAdminEffects(input: {
  endpointKind: string;
  parsedJson: unknown;
}): Promise<GarminPartnerAdminEffectsResult> {
  const empty: GarminPartnerAdminEffectsResult = { deregistrationRemoved: 0, userPermissionsSynced: 0 };

  if (!readOptionalServiceRoleKey()) {
    return empty;
  }

  if (isUserPermissionsEndpointKind(input.endpointKind)) {
    return { ...empty, ...(await syncGarminUserPermissionsFromWebhook(input.parsedJson)) };
  }

  if (!isDeregistrationEndpointKind(input.endpointKind)) {
    return empty;
  }

  const ids = collectGarminUserIdsDeep(input.parsedJson);
  if (ids.length === 0) return empty;

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
    return { deregistrationRemoved: removed, userPermissionsSynced: 0 };
  } catch {
    return empty;
  }
}

async function syncGarminUserPermissionsFromWebhook(
  parsedJson: unknown,
): Promise<{ userPermissionsSynced: number }> {
  const ids = collectGarminUserIdsDeep(parsedJson);
  const fromPayload = extractGarminUserPermissionsFromUnknown(parsedJson);
  const usePayloadForAll =
    fromPayload != null &&
    fromPayload.length > 0 &&
    ids.length === 1;

  try {
    const supabase = createServerSupabaseClient();
    let synced = 0;
    const now = new Date().toISOString();

    for (const garminUserId of ids) {
      let perms: string[] | null = usePayloadForAll ? fromPayload : null;
      if (!perms?.length) {
        const { data: link } = await supabase
          .from("garmin_athlete_links")
          .select("athlete_id")
          .eq("garmin_user_id", garminUserId)
          .maybeSingle();
        const athleteId =
          link && typeof (link as { athlete_id?: string }).athlete_id === "string"
            ? (link as { athlete_id: string }).athlete_id.trim()
            : "";
        if (!athleteId) continue;
        const tokenRes = await ensureFreshGarminAccessTokenForAthlete(supabase, athleteId);
        if ("error" in tokenRes) continue;
        perms = await fetchGarminUserPermissions(tokenRes.accessToken);
      }
      if (!perms?.length) continue;

      const { error } = await supabase
        .from("garmin_athlete_links")
        .update({ user_permissions: perms, updated_at: now })
        .eq("garmin_user_id", garminUserId);
      if (!error) synced += 1;
    }

    return { userPermissionsSynced: synced };
  } catch {
    return { userPermissionsSynced: 0 };
  }
}

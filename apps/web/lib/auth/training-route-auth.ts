import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { canAccessAthleteData } from "@/lib/athlete/can-access-athlete-data";
import { getSupabasePublicConfig } from "@/lib/integrations/integration-status";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseCookieClient } from "@/lib/supabase/server";

/** Errore auth/allenamento — stesso ruolo di V1 `RequestAuthError` per route training. */
export class TrainingRouteAuthError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "TrainingRouteAuthError";
    this.status = status;
  }
}

function readBearer(req: NextRequest): string | null {
  const raw = (req.headers.get("authorization") ?? "").trim();
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

export type AuthenticatedTrainingUser = {
  userId: string;
  /** Client con JWT utente (o cookie session): letture profilo / coach-athletes con RLS. */
  rlsClient: SupabaseClient;
};

/**
 * Utente autenticato: header `Authorization: Bearer` (come V1 `training-write-api`) oppure cookie session.
 */
export async function requireAuthenticatedTrainingUser(req: NextRequest): Promise<AuthenticatedTrainingUser> {
  const config = getSupabasePublicConfig();
  if (!config) {
    throw new TrainingRouteAuthError(503, "supabase_unconfigured");
  }

  const bearer = readBearer(req);
  if (bearer) {
    const verifier = createClient(config.url, config.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: got, error } = await verifier.auth.getUser(bearer);
    if (error || !got.user) {
      throw new TrainingRouteAuthError(401, "unauthorized");
    }
    const rlsClient = createClient(config.url, config.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
    return { userId: got.user.id, rlsClient };
  }

  const cookieClient = createSupabaseCookieClient();
  if (!cookieClient) {
    throw new TrainingRouteAuthError(503, "supabase_unconfigured");
  }
  const { data: got, error } = await cookieClient.auth.getUser();
  if (error || !got.user) {
    throw new TrainingRouteAuthError(401, "unauthorized");
  }
  return { userId: got.user.id, rlsClient: cookieClient };
}

/**
 * Verifica accesso atleta (private / coach) poi restituisce client DB per mutazioni.
 * Se è configurato `SUPABASE_SERVICE_ROLE_KEY`, usa service role per insert/update/delete (parity V1 `createServerSupabaseClient`).
 */
export async function requireTrainingAthleteWriteContext(
  req: NextRequest,
  athleteId: string,
): Promise<{ userId: string; db: SupabaseClient }> {
  const target = athleteId.trim();
  if (!target) {
    throw new TrainingRouteAuthError(400, "Missing athleteId");
  }

  const { userId, rlsClient } = await requireAuthenticatedTrainingUser(req);
  const allowed = await canAccessAthleteData(rlsClient, userId, target, null);
  if (!allowed) {
    throw new TrainingRouteAuthError(403, "forbidden");
  }

  const admin = createSupabaseAdminClient();
  const db = admin ?? rlsClient;
  return { userId, db };
}

/** Lettura “forte” dopo auth utente: preferisci service role se disponibile (es. DELETE guard su id). */
export function supabaseForTrainingReadAfterAuth(rlsClient: SupabaseClient): SupabaseClient {
  return createSupabaseAdminClient() ?? rlsClient;
}

/**
 * Auth training (Bearer o cookie) + `canAccessAthleteData` + client DB per letture tabella.
 * **Import canonico lato app:** `@/lib/auth/athlete-read-context` → `requireAthleteReadContext`.
 */
export async function requireTrainingAthleteReadContext(
  req: NextRequest,
  athleteId: string,
): Promise<{ userId: string; rlsClient: SupabaseClient; db: SupabaseClient }> {
  const target = athleteId.trim();
  if (!target) {
    throw new TrainingRouteAuthError(400, "missing_athleteId");
  }

  const { userId, rlsClient } = await requireAuthenticatedTrainingUser(req);
  const allowed = await canAccessAthleteData(rlsClient, userId, target, null);
  if (!allowed) {
    throw new TrainingRouteAuthError(403, "forbidden");
  }

  const db = supabaseForTrainingReadAfterAuth(rlsClient);
  return { userId, rlsClient, db };
}

import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { coachOrgIdForDb } from "@/lib/coach-org-id";
import { createRequestSupabaseClient } from "@/lib/supabase-server";
import { readSupabaseAnonKey, readSupabasePublicUrl } from "@/lib/supabase-env";

export class RequestAuthError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function readBearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  const trimmed = token.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function readRequestBearerToken(req: NextRequest): string | null {
  return readBearerToken(req);
}

async function resolveRequestUserId(req: NextRequest): Promise<string> {
  const token = readBearerToken(req);
  if (!token) {
    throw new RequestAuthError(401, "Missing bearer token");
  }

  const supabaseUrl = readSupabasePublicUrl();
  const anonKey = readSupabaseAnonKey();
  const verifier = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await verifier.auth.getUser(token);
  if (error || !data.user?.id) {
    throw new RequestAuthError(401, "Invalid bearer token");
  }
  return data.user.id;
}

export async function requireRequestUser(req: NextRequest): Promise<string> {
  return resolveRequestUserId(req);
}

/**
 * Bearer-only + RLS client dedicato. Per **nuove** route Pro 2 preferire
 * `requireAthleteReadContext` da `@/lib/auth/athlete-read-context` (cookie **o** Bearer, stesso gate atleta,
 * service role su letture tabella se configurato) così Training / Nutrition / Health / Dashboard dialogano
 * con la stessa policy.
 */
export async function requireRequestAthleteAccess(req: NextRequest, athleteId: string): Promise<string> {
  const targetAthleteId = athleteId.trim();
  if (!targetAthleteId) {
    throw new RequestAuthError(400, "Missing athleteId");
  }

  const token = readBearerToken(req);
  if (!token) {
    throw new RequestAuthError(401, "Missing bearer token");
  }
  const userId = await resolveRequestUserId(req);
  const supabase = createRequestSupabaseClient(token);
  const { data: profile, error: profileError } = await supabase
    .from("app_user_profiles")
    .select("role, athlete_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) {
    throw new RequestAuthError(500, profileError.message);
  }

  const role = String(profile?.role ?? "private");
  const linkedAthleteId = typeof profile?.athlete_id === "string" ? profile.athlete_id : null;
  if (linkedAthleteId === targetAthleteId) {
    return userId;
  }

  if (role === "coach") {
    const { data: coachLink, error: coachLinkError } = await supabase
      .from("coach_athletes")
      .select("athlete_id")
      .eq("coach_user_id", userId)
      .eq("athlete_id", targetAthleteId)
      .eq("org_id", coachOrgIdForDb())
      .maybeSingle();
    if (coachLinkError) {
      throw new RequestAuthError(500, coachLinkError.message);
    }
    if (coachLink?.athlete_id === targetAthleteId) {
      return userId;
    }
  }

  throw new RequestAuthError(403, "Athlete access denied");
}

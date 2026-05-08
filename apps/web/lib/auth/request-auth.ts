import type { NextRequest } from "next/server";
import { requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { TrainingRouteAuthError, requireAuthenticatedTrainingUser } from "@/lib/auth/training-route-auth";

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
  try {
    const { userId } = await requireAuthenticatedTrainingUser(req);
    return userId;
  } catch (error) {
    if (error instanceof TrainingRouteAuthError) {
      throw new RequestAuthError(error.status, error.message);
    }
    if (error instanceof RequestAuthError) {
      throw error;
    }
    throw new RequestAuthError(500, "Unable to resolve request user");
  }
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

  try {
    const { userId } = await requireAthleteReadContext(req, targetAthleteId);
    return userId;
  } catch (error) {
    if (error instanceof TrainingRouteAuthError) {
      throw new RequestAuthError(error.status, error.message);
    }
    if (error instanceof RequestAuthError) {
      throw error;
    }
    throw new RequestAuthError(500, "Athlete access check failed");
  }
}

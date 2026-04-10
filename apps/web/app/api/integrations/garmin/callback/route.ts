import { NextRequest, NextResponse } from "next/server";
import { resolveAthleteMemory } from "@/lib/memory/athlete-memory-resolver";
import { parseRealityCallbackState, persistRealityProviderCallback } from "@/lib/reality/provider-adapters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Garmin OAuth callback (Connect Developer / Health API).
 * Accetta parametri OAuth1-style e OAuth2 `code` + `state` (state JSON con athleteId).
 */
export async function GET(req: NextRequest) {
  const oauthToken = (req.nextUrl.searchParams.get("oauth_token") ?? "").trim();
  const oauthVerifier = (req.nextUrl.searchParams.get("oauth_verifier") ?? "").trim();
  const code = (req.nextUrl.searchParams.get("code") ?? "").trim();
  const state = (req.nextUrl.searchParams.get("state") ?? "").trim();
  const error = (req.nextUrl.searchParams.get("error") ?? "").trim();
  const callbackState = parseRealityCallbackState(state);
  const callbackExternalRef = callbackState.externalRef || code || oauthToken || null;
  const callbackPayload = {
    oauth_token: oauthToken || null,
    oauth_verifier: oauthVerifier || null,
    code: code || null,
    state: state || null,
    error: error || null,
  };

  let ingestion: Awaited<ReturnType<typeof persistRealityProviderCallback>>["ingestion"] | null = null;
  let athleteMemory: Awaited<ReturnType<typeof resolveAthleteMemory>> | null = null;

  if (callbackState.athleteId) {
    const persisted = await persistRealityProviderCallback({
      athleteId: callbackState.athleteId,
      provider: callbackState.provider ?? "garmin",
      domain: callbackState.domain ?? "device",
      sourceKind: callbackState.sourceKind ?? "api_sync",
      externalRef: callbackExternalRef,
      callbackPayload,
      callbackState,
      queryKeys: Array.from(req.nextUrl.searchParams.keys()),
      hasCode: Boolean(code),
      hasOauthVerifier: Boolean(oauthVerifier),
      hasError: Boolean(error),
    });
    ingestion = persisted.ingestion;
    athleteMemory = await resolveAthleteMemory(callbackState.athleteId);
  }

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        provider: "garmin",
        message: "Garmin callback returned an error.",
        error,
        stateContext: callbackState,
        ingestion,
        athleteMemory,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    provider: "garmin",
    message: "Garmin callback received.",
    stateContext: callbackState,
    ingestion,
    athleteMemory,
    payload: callbackPayload,
  });
}

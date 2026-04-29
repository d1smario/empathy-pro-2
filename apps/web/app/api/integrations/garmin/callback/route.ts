import { NextRequest, NextResponse } from "next/server";
import { AthleteReadContextError, requireAthleteReadContext } from "@/lib/auth/athlete-read-context";
import { resolveAthleteMemory } from "@/lib/memory/athlete-memory-resolver";
import {
  exchangeGarminAuthorizationCode,
  fetchGarminApiUserId,
  fetchGarminUserPermissions,
} from "@/lib/integrations/garmin-oauth2-api";
import { resolveGarminAppBaseUrl } from "@/lib/integrations/garmin-app-base-url";
import { GARMIN_PKCE_COOKIE, unsealGarminPkceCookie } from "@/lib/integrations/garmin-pkce-cookie";
import {
  garminLogIdPrefix,
  logGarminCallbackEvent,
} from "@/lib/integrations/garmin-callback-telemetry";
import { requestGarminSummaryBackfill } from "@/lib/integrations/garmin-wellness-backfill";
import { parseRealityCallbackState, persistRealityProviderCallback } from "@/lib/reality/provider-adapters";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clearPkceCookie(res: NextResponse) {
  res.cookies.set(GARMIN_PKCE_COOKIE, "", { maxAge: 0, path: "/" });
}

/**
 * Garmin OAuth callback (Connect Developer).
 * - OAuth2 PKCE: `code` + cookie PKCE → token → `garmin_athlete_links` → redirect profilo.
 * - Altrimenti: risposta JSON (OAuth1-style / probe) come prima.
 */
export async function GET(req: NextRequest) {
  const appBase = resolveGarminAppBaseUrl(req);
  const oauthToken = (req.nextUrl.searchParams.get("oauth_token") ?? "").trim();
  const oauthVerifier = (req.nextUrl.searchParams.get("oauth_verifier") ?? "").trim();
  const code = (req.nextUrl.searchParams.get("code") ?? "").trim();
  const state = (req.nextUrl.searchParams.get("state") ?? "").trim();
  const error = (req.nextUrl.searchParams.get("error") ?? "").trim();
  const callbackState = parseRealityCallbackState(state);
  const athleteId = callbackState.athleteId?.trim() ?? "";
  const queryParamKeys = Array.from(req.nextUrl.searchParams.keys());

  logGarminCallbackEvent({
    step: "request_received",
    athleteIdPrefix: garminLogIdPrefix(athleteId),
    hasCode: Boolean(code),
    hasOauthVerifier: Boolean(oauthVerifier),
    oauthError: error || undefined,
    queryParamKeys,
  });

  const redirectErr = (reason: string, detailSnippet?: string) => {
    logGarminCallbackEvent({
      step: "redirect_error",
      athleteIdPrefix: garminLogIdPrefix(athleteId),
      reason,
      ...(detailSnippet ? { detailSnippet } : {}),
    });
    const u = new URL(`${appBase}/profile`);
    u.searchParams.set("garmin", "error");
    u.searchParams.set("reason", reason.slice(0, 400));
    if (detailSnippet) {
      u.searchParams.set("detail", detailSnippet.slice(0, 400));
    }
    const res = NextResponse.redirect(u.toString(), 302);
    clearPkceCookie(res);
    return res;
  };

  if (error && athleteId) {
    return redirectErr(error);
  }
  /** Garmin può restituire `error` senza `state` parsabile: evita risposta JSON al browser. */
  if (error && !athleteId) {
    return redirectErr(error, "callback_state_missing_athlete");
  }

  if (code && athleteId) {
    const cookieRaw = req.cookies.get(GARMIN_PKCE_COOKIE)?.value ?? "";
    const sealed = unsealGarminPkceCookie(cookieRaw);
    if (!sealed || sealed.athleteId !== athleteId) {
      return redirectErr(
        "pkce_mismatch",
        sealed ? "athleteId_cookie_state_mismatch" : "cookie_missing_or_invalid",
      );
    }

    const clientId = process.env.GARMIN_OAUTH2_CLIENT_ID?.trim();
    const clientSecret = process.env.GARMIN_OAUTH2_CLIENT_SECRET?.trim();
    const redirectUri =
      process.env.GARMIN_OAUTH2_REDIRECT_URI?.trim() || process.env.GARMIN_OAUTH2_REDIRECT_URL?.trim();
    if (!clientId || !clientSecret || !redirectUri) {
      return redirectErr("oauth2_env_missing");
    }

    try {
      await requireAthleteReadContext(req, athleteId);
    } catch (e) {
      if (e instanceof AthleteReadContextError && e.status === 401) {
        logGarminCallbackEvent({
          step: "auth_required_resume",
          athleteIdPrefix: garminLogIdPrefix(athleteId),
          reason: "athlete_read_401",
        });
        const resume = `${req.nextUrl.pathname}${req.nextUrl.search}`;
        return NextResponse.redirect(
          `${appBase}/access?next=${encodeURIComponent(resume)}&garmin=callback_resume`,
          302,
        );
      }
      if (e instanceof AthleteReadContextError) {
        logGarminCallbackEvent({
          step: "athlete_context_denied",
          athleteIdPrefix: garminLogIdPrefix(athleteId),
          reason: e.message.slice(0, 200),
          detailSnippet: String(e.status),
        });
        return redirectErr(e.message);
      }
      throw e;
    }

    const admin = createSupabaseAdminClient();
    if (!admin) {
      return redirectErr("service_role_unconfigured");
    }

    try {
      logGarminCallbackEvent({
        step: "token_exchange_start",
        athleteIdPrefix: garminLogIdPrefix(athleteId),
      });
      const tokens = await exchangeGarminAuthorizationCode({
        clientId,
        clientSecret,
        code,
        codeVerifier: sealed.verifier,
        redirectUri,
      });
      const garminUserId = await fetchGarminApiUserId(tokens.access_token);
      const userPermissions = await fetchGarminUserPermissions(tokens.access_token);
      const expiresAt = new Date(
        Date.now() + Math.max(60, tokens.expires_in - 600) * 1000,
      ).toISOString();
      const oauthRefreshExpiresAt =
        typeof tokens.refresh_token_expires_in === "number" && Number.isFinite(tokens.refresh_token_expires_in)
          ? new Date(Date.now() + tokens.refresh_token_expires_in * 1000).toISOString()
          : null;

      const { data: conflict } = await admin
        .from("garmin_athlete_links")
        .select("athlete_id")
        .eq("garmin_user_id", garminUserId)
        .neq("athlete_id", athleteId)
        .maybeSingle();

      if (conflict) {
        logGarminCallbackEvent({
          step: "garmin_user_conflict",
          athleteIdPrefix: garminLogIdPrefix(athleteId),
          garminUserIdPrefix: garminLogIdPrefix(garminUserId),
          reason: "garmin_account_already_linked",
        });
        return redirectErr("garmin_account_already_linked");
      }

      const { error: upErr } = await admin.from("garmin_athlete_links").upsert(
        {
          athlete_id: athleteId,
          garmin_user_id: garminUserId,
          oauth_access_token: tokens.access_token,
          oauth_refresh_token: tokens.refresh_token,
          token_expires_at: expiresAt,
          oauth_refresh_expires_at: oauthRefreshExpiresAt,
          scope: tokens.scope ?? null,
          user_permissions: userPermissions,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "athlete_id" },
      );

      if (upErr) {
        logGarminCallbackEvent({
          step: "upsert_garmin_link_failed",
          athleteIdPrefix: garminLogIdPrefix(athleteId),
          garminUserIdPrefix: garminLogIdPrefix(garminUserId),
          detailSnippet: upErr.message.slice(0, 200),
        });
        return redirectErr(upErr.message);
      }

      const callbackExternalRef = garminUserId;
      const callbackPayload = {
        oauth_token: oauthToken || null,
        oauth_verifier: oauthVerifier || null,
        code: code || null,
        state: state || null,
        error: error || null,
        garmin_user_id: garminUserId,
      };

      await persistRealityProviderCallback({
        athleteId,
        provider: callbackState.provider ?? "garmin",
        domain: callbackState.domain ?? "device",
        sourceKind: callbackState.sourceKind ?? "api_sync",
        externalRef: callbackExternalRef,
        callbackPayload,
        callbackState: { ...(callbackState as unknown as Record<string, unknown>), garminUserId },
        queryKeys: Array.from(req.nextUrl.searchParams.keys()),
        hasCode: true,
        hasOauthVerifier: Boolean(oauthVerifier),
        hasError: false,
      });

      /** Summary Backfill post-collegamento (apiDocs): best-effort, non blocca il redirect. */
      const backfillEnd = Math.floor(Date.now() / 1000);
      const backfillStart = backfillEnd - 14 * 86400;
      void requestGarminSummaryBackfill({
        accessToken: tokens.access_token,
        stream: "activityDetails",
        summaryStartTimeInSeconds: backfillStart,
        summaryEndTimeInSeconds: backfillEnd,
      })
        .then((br) => {
          if (br.ok) {
            logGarminCallbackEvent({
              step: "post_connect_backfill_ok",
              athleteIdPrefix: garminLogIdPrefix(athleteId),
              detailSnippet: `activityDetails_http_${br.httpStatus}`,
            });
          } else {
            logGarminCallbackEvent({
              step: "post_connect_backfill_fail",
              athleteIdPrefix: garminLogIdPrefix(athleteId),
              detailSnippet: `${br.httpStatus}:${(br.errorMessage ?? "").slice(0, 160)}`,
            });
          }
        })
        .catch((be) => {
          logGarminCallbackEvent({
            step: "post_connect_backfill_exception",
            athleteIdPrefix: garminLogIdPrefix(athleteId),
            detailSnippet: be instanceof Error ? be.message.slice(0, 200) : "unknown",
          });
        });

      logGarminCallbackEvent({
        step: "connected",
        athleteIdPrefix: garminLogIdPrefix(athleteId),
        garminUserIdPrefix: garminLogIdPrefix(garminUserId),
      });
      const res = NextResponse.redirect(`${appBase}/profile?garmin=connected`, 302);
      clearPkceCookie(res);
      return res;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "token_exchange_failed";
      logGarminCallbackEvent({
        step: "token_exchange_or_profile_failed",
        athleteIdPrefix: garminLogIdPrefix(athleteId),
        reason: "exception",
        detailSnippet: msg.slice(0, 400),
      });
      return redirectErr(msg);
    }
  }

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

  logGarminCallbackEvent({
    step: "non_pkce_branch",
    athleteIdPrefix: garminLogIdPrefix(callbackState.athleteId),
    hasCode: Boolean(code),
    hasOauthVerifier: Boolean(oauthVerifier),
    oauthError: error || undefined,
    queryParamKeys,
  });

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

import type { PendingAppRole } from "@/lib/auth/pending-role-cookie";

/** Atleta: dopo registrazione → prova / checkout Stripe. */
export const ACCESS_POST_SIGNUP_PLAN_PATH = "/access/plan";

/**
 * Destinazione dopo **registrazione** (sessione immediata o link email con `next` già impostato).
 * Coach → hub Atleti (messaggio pending in pagina).
 */
export function postSignupRegistrationPath(appRole: PendingAppRole): string {
  return appRole === "coach" ? "/athletes" : ACCESS_POST_SIGNUP_PLAN_PATH;
}

/**
 * Dopo **login** con password: coach sempre verso hub Atleti; atleta rispetta `next` sicuro.
 */
export function postSignInRedirectPath(redirectAfterLogin: string, appRole: PendingAppRole): string {
  const path = redirectAfterLogin.startsWith("/") ? redirectAfterLogin : `/${redirectAfterLogin}`;
  if (appRole === "coach") return "/athletes";
  return path;
}

/**
 * `next` passato a `/auth/callback` dal link email (magic link / OTP).
 * Coach → hub Atleti. Atleta: se l’ingresso è il default (`/` o `/dashboard`) → gate abbonamento; altrimenti rispetta `redirectAfterLogin` già validato lato `/access`.
 */
export function postOtpEmailRedirectNext(redirectAfterLogin: string, appRole: PendingAppRole): string {
  if (appRole === "coach") return "/athletes";
  const path = redirectAfterLogin.startsWith("/") ? redirectAfterLogin : `/${redirectAfterLogin}`;
  if (path === "/dashboard" || path === "/") return ACCESS_POST_SIGNUP_PLAN_PATH;
  return path;
}

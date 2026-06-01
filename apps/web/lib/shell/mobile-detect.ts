import type { NextRequest } from "next/server";
import {
  EMPATHY_DESKTOP_COOKIE,
  EMPATHY_MOBILE_COOKIE,
} from "@/core/navigation/mobile-module-registry";

export type MobilePreferenceInput = {
  desktopCookie?: string | null;
  mobileCookie?: string | null;
  userAgent?: string | null;
  secChUaMobile?: string | null;
};

/** UA mobile (telefono/tablet) senza cookie preferenza. */
export function isMobileUserAgent(ua: string, secChUaMobile?: string | null): boolean {
  if (secChUaMobile === "?1") return true;

  if (/iPad/i.test(ua)) return true;
  if (/Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true;
  // iPadOS 13+ in modalità desktop può riportare Macintosh + Mobile
  if (/Macintosh/i.test(ua) && /Mobile/i.test(ua)) return true;

  return false;
}

/** Preferenza shell mobile: cookie `empathy_mobile` vince su opt-out desktop. */
export function isMobilePreferred(input: MobilePreferenceInput): boolean {
  if (input.mobileCookie === "1") return true;
  if (input.desktopCookie === "1") return false;

  const ua = input.userAgent ?? "";
  return isMobileUserAgent(ua, input.secChUaMobile);
}

/** True se la richiesta proviene da client mobile e l'utente non ha optato per desktop. */
export function isMobileClientRequest(request: NextRequest): boolean {
  return isMobilePreferred({
    desktopCookie: request.cookies.get(EMPATHY_DESKTOP_COOKIE)?.value,
    mobileCookie: request.cookies.get(EMPATHY_MOBILE_COOKIE)?.value,
    userAgent: request.headers.get("user-agent"),
    secChUaMobile: request.headers.get("sec-ch-ua-mobile"),
  });
}

/** Client browser (login form, banner recupero). */
export function isMobileBrowserClient(): boolean {
  if (typeof navigator === "undefined") return false;
  return isMobileUserAgent(navigator.userAgent);
}

import type { NextRequest } from "next/server";
import { EMPATHY_DESKTOP_COOKIE } from "@/core/navigation/mobile-module-registry";

/** True se la richiesta proviene da client mobile e l'utente non ha optato per desktop. */
export function isMobileClientRequest(request: NextRequest): boolean {
  if (request.cookies.get(EMPATHY_DESKTOP_COOKIE)?.value === "1") return false;

  const chMobile = request.headers.get("sec-ch-ua-mobile");
  if (chMobile === "?1") return true;

  const ua = request.headers.get("user-agent") ?? "";
  return /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

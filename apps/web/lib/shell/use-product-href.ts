"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { isMobileAppPath, toMobilePath } from "@/core/navigation/mobile-module-registry";

/** True se la shell corrente è l'app mobile (`/m/*`). */
export function useIsMobileApp(): boolean {
  const pathname = usePathname() ?? "/";
  return isMobileAppPath(pathname);
}

/**
 * Mappa href desktop → `/m/...` quando l'utente è nella shell mobile.
 * Path senza equivalente mobile (builder, coach) restano desktop.
 */
export function useProductHref(desktopPath: string): string {
  const pathname = usePathname() ?? "/";
  return useMemo(() => productHrefForPathname(desktopPath, pathname), [desktopPath, pathname]);
}

export function productHrefForPathname(desktopPath: string, pathname: string): string {
  if (!isMobileAppPath(pathname)) return desktopPath;
  return toMobilePath(desktopPath) ?? desktopPath;
}

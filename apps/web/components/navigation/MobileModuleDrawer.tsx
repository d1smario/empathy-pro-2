"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { MOBILE_DRAWER_LINKS, EMPATHY_DESKTOP_COOKIE } from "@/core/navigation/mobile-module-registry";
import { Pro2Button } from "@/components/ui/empathy";

type MobileModuleDrawerProps = {
  open: boolean;
  onClose: () => void;
};

function setDesktopPreferenceCookie() {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${EMPATHY_DESKTOP_COOKIE}=1; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function MobileModuleDrawer({ open, onClose }: MobileModuleDrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Menu moduli">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label="Chiudi menu"
        onClick={onClose}
      />
      <div className="absolute bottom-0 left-0 right-0 max-h-[min(85vh,32rem)] overflow-y-auto rounded-t-2xl border border-white/10 bg-zinc-950 pb-[env(safe-area-inset-bottom,0px)] shadow-2xl shadow-purple-950/40">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <p className="text-sm font-bold text-white">Moduli</p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-gray-300"
            aria-label="Chiudi"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <ul className="space-y-1 p-3">
          {MOBILE_DRAWER_LINKS.map((item) => (
            <li key={item.label}>
              {item.desktopOnly && item.label === "Versione desktop" ? (
                <Pro2Button
                  type="button"
                  variant="secondary"
                  className="w-full justify-start border-white/15 bg-white/5"
                  onClick={() => {
                    setDesktopPreferenceCookie();
                    window.location.href = "/dashboard";
                  }}
                >
                  {item.label}
                </Pro2Button>
              ) : (
                <Link
                  href={item.href}
                  onClick={onClose}
                  className="flex w-full items-center rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-gray-200 transition hover:border-purple-500/35 hover:bg-white/10"
                >
                  {item.label}
                  {item.desktopOnly ? (
                    <span className="ml-auto font-mono text-[0.6rem] uppercase text-gray-500">Desktop</span>
                  ) : null}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

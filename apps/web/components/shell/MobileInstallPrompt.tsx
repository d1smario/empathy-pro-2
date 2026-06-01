"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Pro2Button } from "@/components/ui/empathy";

const DISMISS_KEY = "empathy_pwa_install_dismissed_v1";

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Banner install PWA — solo shell mobile, non in standalone.
 */
export function MobileInstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandaloneDisplay()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    /** iOS: nessun beforeinstallprompt — mostra hint generico una volta. */
    const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isIos) setVisible(true);

    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  const install = async () => {
    if (!deferredPrompt) {
      dismiss();
      return;
    }
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    dismiss();
  };

  return (
    <div className="mx-auto max-w-lg px-4 pb-2 pt-1">
      <div className="flex items-start gap-3 rounded-2xl border border-fuchsia-500/30 bg-fuchsia-950/40 px-3 py-3 shadow-lg shadow-fuchsia-950/30">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Installa Empathy</p>
          <p className="mt-0.5 text-xs text-gray-400">
            {deferredPrompt
              ? "Aggiungi alla home per aprire l'app a schermo intero."
              : "Su iPhone: Condividi → Aggiungi a Home. Su Android: Installa app dal menu browser."}
          </p>
          {deferredPrompt ? (
            <Pro2Button type="button" className="mt-2 h-8 px-3 text-xs" onClick={() => void install()}>
              Installa
            </Pro2Button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-white/10 hover:text-white"
          aria-label="Chiudi"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

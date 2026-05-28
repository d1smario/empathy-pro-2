"use client";

import { useEffect } from "react";

/**
 * Controller PWA: ascolta gli update del Service Worker e li applica
 * IMMEDIATAMENTE.
 *
 * Senza questo handler, dopo un deploy il browser:
 *  1. Scarica il nuovo `/sw.js` ma lo lascia in stato "waiting".
 *  2. Continua a usare il SW vecchio per la sessione corrente.
 *  3. Mostra al utente la cache obsoleta (HTML/RSC payload precaricati)
 *     finche' tutte le tab non vengono chiuse.
 *
 * Soluzione:
 *  - `skipWaiting` + `clientsClaim` lato Workbox (vedi `next.config.mjs`)
 *    -> il nuovo SW si attiva subito.
 *  - `controllerchange` lato client -> ricarichiamo la pagina UNA VOLTA
 *    sola dopo che il nuovo SW prende il controllo, cosi' la UI mostra
 *    immediatamente i dati freschi (es. dopo import workout).
 *
 * Idempotente: il flag `__empathyPwaReloadDone` evita loop di reload.
 */
export function PWAUpdateController(): null {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "development") return;

    const w = window as Window & { __empathyPwaReloadDone?: boolean };

    const onControllerChange = () => {
      if (w.__empathyPwaReloadDone) return;
      w.__empathyPwaReloadDone = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    void navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;
      /** Forza check immediato all'avvio: copre il caso "tab gia' aperta da ore". */
      reg.update().catch(() => {});
      /** Se c'e' un SW gia' in waiting, attivalo subito. */
      if (reg.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      }
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            installing.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });
    });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}

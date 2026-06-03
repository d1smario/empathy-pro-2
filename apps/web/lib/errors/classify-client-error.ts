export type ClientErrorKind = "stale_bundle" | "network" | "generic";

export type ClassifiedClientError = {
  kind: ClientErrorKind;
  titleIt: string;
  bodyIt: string;
  /** Suggerisce reload completo (deploy / chunk mancante). */
  suggestHardReload: boolean;
};

function messageOf(error: Error): string {
  return `${error.name} ${error.message}`.toLowerCase();
}

/** Riconosce errori tipici post-deploy PWA o rete instabile (non sono redirect auth). */
export function classifyClientError(error: Error & { digest?: string }): ClassifiedClientError {
  const msg = messageOf(error);
  const digest = typeof error.digest === "string" ? error.digest : "";

  const staleBundle =
    msg.includes("loading chunk") ||
    msg.includes("chunkloaderror") ||
    msg.includes("failed to fetch dynamically imported module") ||
    msg.includes("importing a module script failed") ||
    msg.includes("dynamically imported module") ||
    digest.includes("DYNAMIC");

  if (staleBundle) {
    return {
      kind: "stale_bundle",
      titleIt: "Aggiornamento app in corso",
      bodyIt:
        "Il browser sta ancora usando una versione precedente dell’app (comune dopo un deploy). Ricarica la pagina; se persiste, chiudi tutte le tab di Empathy e riapri.",
      suggestHardReload: true,
    };
  }

  const network =
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("load failed") ||
    msg.includes("timed out") ||
    msg.includes("timeout") ||
    error.name === "AbortError";

  if (network) {
    return {
      kind: "network",
      titleIt: "Connessione interrotta",
      bodyIt:
        "La richiesta al server non è arrivata a termine (rete lenta, tab in background o server momentaneamente non disponibile). Riprova tra qualche secondo.",
      suggestHardReload: false,
    };
  }

  return {
    kind: "generic",
    titleIt: "Qualcosa non ha funzionato",
    bodyIt:
      "Si è verificato un errore imprevisto nel caricamento della pagina. Riprova; se il problema persiste, torna alla home o contatta il supporto indicando l’ora e la sezione visitata.",
    suggestHardReload: false,
  };
}

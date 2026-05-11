/**
 * Lingue prodotto Pro 2 — costanti **client-safe** allineate alla migration 057.
 *
 * Il superset (`KNOWN_LOCALES`) elenca ogni lingua per cui esiste una riga in
 * `public.supported_locales`. Le lingue effettivamente esposte in UI sono filtrate
 * dal DB su `is_enabled = true` (lookup runtime, vedi `loadEnabledLocales`).
 *
 * **Default canonico**: `it`. **Fallback universale**: `en`. Tutte le route
 * server-side devono accettare solo lingue ammesse — `isKnownLocale` blocca
 * input arbitrari, `coerceLocale` normalizza con fallback default.
 *
 * Niente import di server-only qui: la costante serve anche al client per
 * accettare/mostrare la scelta utente nel selettore.
 */

export const DEFAULT_LOCALE = "it" as const;
export const FALLBACK_LOCALE = "en" as const;

export const KNOWN_LOCALES = [
  "it",
  "en",
  "fr",
  "es",
  "de",
  "nl",
  "no",
  "sv",
  "pt",
  "ru",
  "zh",
  "ja",
  "ar",
] as const;

export type SupportedLocale = (typeof KNOWN_LOCALES)[number];

export type LocaleRow = {
  code: SupportedLocale;
  displayName: string;
  isEnabled: boolean;
  rtl: boolean;
  sortOrder: number;
};

/** Type-guard: stringa arbitraria → SupportedLocale. */
export function isKnownLocale(value: unknown): value is SupportedLocale {
  return typeof value === "string" && (KNOWN_LOCALES as readonly string[]).includes(value);
}

/** Normalizza input free-form ("en-US", "EN", "fr-FR") → SupportedLocale o default. */
export function coerceLocale(value: string | null | undefined, fallback: SupportedLocale = DEFAULT_LOCALE): SupportedLocale {
  if (!value) return fallback;
  const raw = value.trim().toLowerCase();
  if (isKnownLocale(raw)) return raw;
  const primary = raw.split(/[-_]/)[0];
  if (primary && isKnownLocale(primary)) return primary;
  return fallback;
}

/**
 * Parser **deterministico** per `Accept-Language` (RFC 9110). Restituisce la
 * **prima** locale conosciuta nell'ordine di preferenza (q-values ordinati).
 *
 * Esempio: `it-IT,it;q=0.9,en-US;q=0.7,en;q=0.6` → `it`.
 * Esempio: `de-DE,de;q=0.9,en;q=0.5` → `en` (se `de` non in enabled set).
 *
 * Il filtro `enabled` deve arrivare dal caller: questa funzione non legge il DB.
 */
export function parseAcceptLanguageToLocale(
  headerValue: string | null | undefined,
  enabledLocales: readonly SupportedLocale[],
): SupportedLocale | null {
  if (!headerValue) return null;
  const enabledSet = new Set<SupportedLocale>(enabledLocales);

  const entries = headerValue
    .split(",")
    .map((chunk) => {
      const [tag, ...params] = chunk.trim().split(";");
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const q = qParam ? Number.parseFloat(qParam.split("=")[1] ?? "1") : 1;
      return { tag: tag?.trim().toLowerCase() ?? "", q: Number.isFinite(q) ? q : 0 };
    })
    .filter((e) => e.tag.length > 0 && e.q > 0)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of entries) {
    if (isKnownLocale(tag) && enabledSet.has(tag)) return tag;
    const primary = tag.split(/[-_]/)[0];
    if (primary && isKnownLocale(primary) && enabledSet.has(primary)) return primary;
  }
  return null;
}

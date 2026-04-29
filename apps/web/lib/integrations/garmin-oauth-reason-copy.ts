/**
 * Testi guida per codici `reason` restituiti da `/api/integrations/garmin/callback`
 * (query `reason` + opzionale `detail` sulla redirect a /profile).
 */

export type GarminOAuthReasonGuidance = {
  title: string;
  bullets: string[];
};

const BY_REASON: Record<string, GarminOAuthReasonGuidance> = {
  access_denied: {
    title: "Hai annullato il consenso o Garmin ha rifiutato l’autorizzazione.",
    bullets: [
      "Riprova «Collega Garmin» e accetta tutti i permessi richiesti dall’app nel portale Garmin Developer.",
      "Verifica che l’account Garmin Connect usato sia quello previsto per i test (account personali limitati fino ad approvazione produzione).",
      "Controlla nel portale che le capability Health API attese siano abilitate per l’applicazione e coerenti con i dati che vuoi ricevere.",
    ],
  },
  pkce_mismatch: {
    title: "Cookie PKCE non valido o sessione cambiata prima del ritorno da Garmin.",
    bullets: [
      "Completa il flusso nello stesso browser, senza incognito alternato o pulizia cookie a metà.",
      "Se il consenso richiede molto tempo, riavvia da «Collega Garmin» (il cookie PKCE scade dopo ~30 minuti).",
      "Assicurati che `GARMIN_OAUTH_PKCE_SECRET` in produzione sia impostato e stabile (ridistribuzione dopo modifiche).",
    ],
  },
  oauth2_env_missing: {
    title: "Mancano variabili OAuth sul server.",
    bullets: [
      "In Vercel: `GARMIN_OAUTH2_CLIENT_ID`, `GARMIN_OAUTH2_CLIENT_SECRET`, `GARMIN_OAUTH2_REDIRECT_URI` (o `GARMIN_OAUTH2_REDIRECT_URL`) devono essere valorizzate e coincidenti con il portale Garmin.",
    ],
  },
  service_role_unconfigured: {
    title: "Supabase service role non configurato.",
    bullets: [
      "Imposta `SUPABASE_SERVICE_ROLE_KEY` nell’ambiente di deploy e ridistribuisci.",
    ],
  },
  garmin_account_already_linked: {
    title: "Questo account Garmin è già collegato a un altro profilo atleta in Empathy.",
    bullets: [
      "Scollega dall’altro atleta o usa un altro account Garmin per questo profilo.",
    ],
  },
  invalid_grant: {
    title: "Garmin ha rifiutato lo scambio del codice (grant non valido).",
    bullets: [
      "Controlla che il redirect URI in Vercel sia identico byte-per-byte a quello registrato nel portale Garmin.",
      "Verifica che client id e client secret corrispondano alla stessa app Garmin.",
      "Non riusare un codice già scambiato: riparti da «Collega Garmin».",
    ],
  },
  unauthorized_client: {
    title: "Client OAuth non autorizzato per questa operazione.",
    bullets: [
      "Verifica nel portale Garmin che l’app sia abilitata per OAuth2 PKCE e per gli endpoint richiesti.",
    ],
  },
};

export function garminOAuthReasonGuidance(reason: string | null): GarminOAuthReasonGuidance | null {
  if (!reason) return null;
  if (BY_REASON[reason]) return BY_REASON[reason];
  const lower = reason.toLowerCase();
  if (lower.includes("invalid_grant")) return BY_REASON.invalid_grant;
  if (lower.includes("token exchange")) {
    return {
      title: "Errore durante lo scambio del codice con Garmin.",
      bullets: [
        ...BY_REASON.invalid_grant.bullets,
        `Dettaglio tecnico: ${reason.slice(0, 280)}${reason.length > 280 ? "…" : ""}`,
      ],
    };
  }
  return null;
}

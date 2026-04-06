import "server-only";

/** Punto 4 — usare solo da Route Handler / Server Components (no client bundle). */
export {
  getIntegrationPresence,
  getSupabasePublicConfig,
  type IntegrationPresence,
} from "./integration-status";

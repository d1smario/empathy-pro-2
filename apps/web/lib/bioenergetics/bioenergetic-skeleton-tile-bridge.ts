/**
 * Ponte skeleton v1 ↔ surface prodotto (tile id, canali continui).
 * Ogni nuovo nodo in `metabolic-endocrine-interaction-skeleton-v1` che modula UI numerica
 * va registrato qui (convogliamento, niente duplicazione mapping sparsa).
 *
 * @see packages/domain-bioenergetics/src/metabolic-endocrine-interaction-skeleton-v1.ts
 * @see docs/BIOENERGETIC_PRODUCT_ROADMAP.md fase 1.1
 */

/** `BioenergeticMetricTile.id` pilotato da osservabilità skeleton (fase 1.1+; estendere per nuovi nodi). */
export const SKELETON_NODE_TO_METRIC_TILE_ID: Readonly<Record<string, string>> = {
  /** Nodo solo grafo / osservabilità v1; nessuna tile metrica dedicata. */
  sleep: "__no_metric_tile_v1__",
  leptin_energy_balance: "leptin",
  ghrelin: "ghrelin",
  gh_pulse: "gh",
  /** Tile lab insulina a digiuno / proxy panel; proxy orario continuo resta su kernel. */
  insulin_demand: "insulin_lab",
} as const;

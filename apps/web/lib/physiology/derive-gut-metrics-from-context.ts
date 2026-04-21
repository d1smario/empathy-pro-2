/** Stesso union usato in `PhysiologyPageView` / tile microbiota preset. */
export type DysbiosisPresetLevel = "eubiosi" | "lieve" | "moderata" | "severa" | "grave";

export type MicrobiotaTaxaPct = {
  candida_overgrowth_pct: number;
  bifidobacteria_pct: number;
  akkermansia_pct: number;
  butyrate_producers_pct: number;
  endotoxin_risk_pct: number;
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

/** Allineato alla logica qualitativa di `gut-absorption-engine` (penalità dysbiosi → meno assorbimento, più stress). */
export function gutMetricsFromTaxa(t: MicrobiotaTaxaPct): {
  gut_absorption_pct: number;
  microbiota_sequestration_pct: number;
  gut_training_pct: number;
} {
  const candida = clamp(t.candida_overgrowth_pct, 0, 100);
  const endotoxin = clamp(t.endotoxin_risk_pct, 0, 100);
  const bifido = clamp(t.bifidobacteria_pct, 0, 100);
  const akk = clamp(t.akkermansia_pct, 0, 100);
  const butyrate = clamp(t.butyrate_producers_pct, 0, 100);

  const dysbiosis01 = clamp(
    (candida / 100) * 0.35 + (endotoxin / 100) * 0.35 - (bifido / 100) * 0.12 - (akk / 100) * 0.1 - (butyrate / 100) * 0.08,
    0,
    1,
  );

  const gut_absorption_pct = Math.round(clamp(90 - dysbiosis01 * 18, 68, 94));
  const microbiota_sequestration_pct = Math.round(clamp(5 + dysbiosis01 * 16, 3, 24));
  const gut_training_pct = Math.round(clamp(78 - dysbiosis01 * 12, 52, 84));

  return { gut_absorption_pct, microbiota_sequestration_pct, gut_training_pct };
}

export function gutMetricsFromDysbiosisPreset(level: DysbiosisPresetLevel): {
  gut_absorption_pct: number;
  microbiota_sequestration_pct: number;
  gut_training_pct: number;
} {
  switch (level) {
    case "eubiosi":
      return { gut_absorption_pct: 90, microbiota_sequestration_pct: 5, gut_training_pct: 80 };
    case "lieve":
      return { gut_absorption_pct: 86, microbiota_sequestration_pct: 8, gut_training_pct: 76 };
    case "moderata":
      return { gut_absorption_pct: 81, microbiota_sequestration_pct: 12, gut_training_pct: 70 };
    case "severa":
      return { gut_absorption_pct: 75, microbiota_sequestration_pct: 16, gut_training_pct: 62 };
    case "grave":
    default:
      return { gut_absorption_pct: 70, microbiota_sequestration_pct: 20, gut_training_pct: 55 };
  }
}

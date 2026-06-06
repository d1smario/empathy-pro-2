import type { DailyNutritionRequirementsV2 } from "@empathy/contracts";
import type { NutritionPerformanceIntegrationDials } from "@/lib/nutrition/performance-integration-scaler";

function round(n: number, d = 1): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Performance integration modula solo composizione fueling (CHO/h), non fabbisogno totale.
 */
export function applyPerformanceIntegrationToSubstrateFueling(
  requirements: DailyNutritionRequirementsV2,
  integration: NutritionPerformanceIntegrationDials,
): DailyNutritionRequirementsV2 {
  const sf = requirements.substrateFueling;
  if (!sf?.sessions.length) return requirements;

  const scale = integration.fuelingChoScale ?? 1;
  if (scale === 1) {
    return {
      ...requirements,
      provenance: [
        ...requirements.provenance,
        `Integrazione performance: CHO/h fueling ×${scale} (informativo recovery/bio).`,
        ...integration.rationale.slice(0, 3),
      ],
    };
  }

  const sessions = sf.sessions.map((s) => {
    const intraChoG = round(s.intraChoG * scale);
    const intraChoGPerH = s.durationH > 0 ? round(intraChoG / s.durationH) : 0;
    return {
      ...s,
      intraChoG,
      intraChoGPerH,
    };
  });

  const intraChoG = round(sessions.reduce((sum, x) => sum + x.intraChoG, 0));
  const fuelingKcal = Math.round(sf.totals.preChoG * 4 + intraChoG * 4 + sf.totals.postChoG * 4);
  const mealsKcal = Math.max(800, Math.round(requirements.energy.dailyKcal - fuelingKcal));

  return {
    ...requirements,
    energy: {
      ...requirements.energy,
      mealsKcal,
      fuelingKcal,
    },
    substrateFueling: {
      ...sf,
      sessions,
      totals: {
        ...sf.totals,
        intraChoG,
        fuelingKcal,
      },
    },
    provenance: [
      ...requirements.provenance,
      `Integrazione performance: intra CHO scalato ×${scale} (cap evidence in composer fueling).`,
      ...integration.rationale.slice(0, 3),
    ],
  };
}
